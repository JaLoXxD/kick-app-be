import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AlertConfig, VoiceProfile } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppConfig } from '../config/configuration';
import {
  KickFollowEvent,
  KickInternalEvent,
  KickGiftSubscriptionEvent,
  KickKicksEvent,
  KickSubscriptionEvent,
} from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { BlockedWordsService } from '../settings/blocked-words.service';
import { SettingsService } from '../settings/settings.service';
import { OverlayPresenceService } from '../tts/overlay-presence.service';
import { SpendTrackerService } from '../tts/spend-tracker.service';
import { TTS_PROVIDER, TtsInsufficientBalanceError, TtsProvider } from '../tts/tts.provider';
import { TtsInternalEvent } from '../tts/tts-queue.service';
import { MediaKind, detectMedia } from './alert-media.util';
import {
  ALERT_DEFAULTS,
  AlertPlayPayload,
  AlertTextPart,
  AlertType,
  AlertsInternalEvent,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
} from './alerts.constants';
import { UpdateAlertConfigDto } from './dto/update-alert-config.dto';

/** Un mismo usuario no dispara la alerta de seguidor dos veces en este lapso (evita spam de seguir/dejar de seguir). */
const REPEAT_FOLLOW_WINDOW_MS = 60 * 60_000;
const MAX_TTS_CHARS = 200;

export interface TriggerOptions {
  test: boolean;
  /** KICKs enviados o suscripciones regaladas; reemplaza a {cantidad}. */
  amount?: number;
}

export interface TriggerResult {
  delivered: boolean;
  reason?: 'disabled' | 'no-overlay' | 'repeat' | 'blocked-name' | 'below-minimum';
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private readonly dir: string;
  private readonly recentFollowers = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly presence: OverlayPresenceService,
    private readonly spendTracker: SpendTrackerService,
    private readonly settingsService: SettingsService,
    private readonly blockedWords: BlockedWordsService,
    @Inject(TTS_PROVIDER) private readonly ttsProvider: TtsProvider,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.dir = configService.get('alerts', { infer: true }).dir;
  }

  getMediaPath(file: string): string {
    return join(this.dir, file);
  }

  async getConfig(type: AlertType): Promise<AlertConfig> {
    const defaults = ALERT_DEFAULTS[type];
    return this.prisma.alertConfig.upsert({
      where: { eventType: type },
      create: {
        eventType: type,
        enabled: false,
        textTemplate: defaults.textTemplate,
        ttsEnabled: true,
        ttsTemplate: defaults.ttsTemplate,
      },
      update: {},
    });
  }

  async update(type: AlertType, dto: UpdateAlertConfigDto): Promise<AlertConfig> {
    await this.getConfig(type);
    return this.prisma.alertConfig.update({ where: { eventType: type }, data: dto });
  }

  /** ¿Hay un overlay de alertas abierto para reproducir algo? */
  canPlay(): boolean {
    return this.presence.hasAlertListeners();
  }

  /** Guarda un audio suelto (p. ej. de un comando de puntos) y devuelve el nombre del archivo. */
  async storeAudio(file: { buffer: Buffer; size: number } | undefined): Promise<string> {
    if (!file) {
      throw new BadRequestException('Falta el archivo (campo "file")');
    }
    const detected = detectMedia(file.buffer);
    if (!detected || detected.kind !== 'audio') {
      throw new BadRequestException('Formato no válido: usa MP3, WAV u OGG');
    }
    if (file.size > MAX_AUDIO_BYTES) {
      throw new PayloadTooLargeException(`El archivo supera ${MAX_AUDIO_BYTES / 1024 / 1024} MB`);
    }
    await mkdir(this.dir, { recursive: true });
    const fileName = `${randomUUID()}.${detected.ext}`;
    await writeFile(join(this.dir, fileName), file.buffer);
    return fileName;
  }

  /** Borra un archivo de medios guardado por `storeAudio`. */
  removeStoredFile(file: string | null): Promise<void> {
    return this.deleteFile(file);
  }

  /**
   * Reproduce en el overlay de alertas un sonido y/o una voz (sin texto ni imagen). Devuelve false si no
   * salió nada (sin overlay abierto, o solo voz y no se pudo sintetizar), para que quien llama no cobre.
   */
  async playCustom(options: {
    username: string;
    audioFile: string | null;
    ttsText: string | null;
    voiceProfileId: string | null;
  }): Promise<boolean> {
    if (!this.presence.hasAlertListeners()) {
      return false;
    }
    const ttsText = options.ttsText?.trim().slice(0, MAX_TTS_CHARS) ?? '';
    const tts = ttsText ? await this.synthesizeText(ttsText, options.voiceProfileId) : null;
    if (!options.audioFile && !tts) {
      return false;
    }
    const settings = this.settingsService.get();
    const payload: AlertPlayPayload = {
      id: randomUUID(),
      kind: 'command',
      username: options.username,
      text: '',
      textParts: [],
      variableColor: '#ffffff',
      imageFile: null,
      audioFile: options.audioFile,
      ttsAudioBase64: tts?.audioBase64 ?? null,
      ttsMimeType: tts?.mimeType ?? null,
      ttsPitch: tts?.pitch ?? 0,
      normalize: settings.normalizeVolume,
      durationSeconds: 1,
      volume: settings.volume,
      style: { fontFamily: 'Montserrat', fontSize: 24, textColor: '#ffffff', outlineColor: '#000000', outlineWidth: 0 },
    };
    this.eventEmitter.emit(AlertsInternalEvent.PLAY, payload);
    return true;
  }

  /** Guarda una imagen/GIF o un audio, reemplazando (y borrando) el anterior. */
  async saveMedia(
    type: AlertType,
    kind: MediaKind,
    file: { buffer: Buffer; size: number } | undefined,
  ): Promise<AlertConfig> {
    if (!file) {
      throw new BadRequestException('Falta el archivo (campo "file")');
    }
    const detected = detectMedia(file.buffer);
    if (!detected || detected.kind !== kind) {
      throw new BadRequestException(
        kind === 'image'
          ? 'Formato no válido: usa PNG, JPG, GIF o WebP'
          : 'Formato no válido: usa MP3, WAV u OGG',
      );
    }
    const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
    if (file.size > limit) {
      throw new PayloadTooLargeException(`El archivo supera ${limit / 1024 / 1024} MB`);
    }

    await mkdir(this.dir, { recursive: true });
    const fileName = `${randomUUID()}.${detected.ext}`;
    await writeFile(join(this.dir, fileName), file.buffer);

    const current = await this.getConfig(type);
    const field = kind === 'image' ? 'imageFile' : 'audioFile';
    const previous = current[field];
    const updated = await this.prisma.alertConfig.update({
      where: { eventType: type },
      data: { [field]: fileName },
    });
    await this.deleteFile(previous);
    return updated;
  }

  async removeMedia(type: AlertType, kind: MediaKind): Promise<AlertConfig> {
    const current = await this.getConfig(type);
    const field = kind === 'image' ? 'imageFile' : 'audioFile';
    const updated = await this.prisma.alertConfig.update({
      where: { eventType: type },
      data: { [field]: null },
    });
    await this.deleteFile(current[field]);
    return updated;
  }

  @OnEvent(KickInternalEvent.FOLLOW)
  handleFollow(event: KickFollowEvent): Promise<void> {
    return this.handleKickEvent('follow', event.username, undefined);
  }

  @OnEvent(KickInternalEvent.KICKS)
  handleKicks(event: KickKicksEvent): Promise<void> {
    return this.handleKickEvent('kicks', event.username, event.amount);
  }

  @OnEvent(KickInternalEvent.SUBSCRIPTION)
  handleSubscription(event: KickSubscriptionEvent): Promise<void> {
    return this.handleKickEvent('subscription', event.username, undefined);
  }

  @OnEvent(KickInternalEvent.GIFT_SUBSCRIPTION)
  handleGiftSubscription(event: KickGiftSubscriptionEvent): Promise<void> {
    return this.handleKickEvent('gift', event.username, event.amount);
  }

  private async handleKickEvent(type: AlertType, username: string, amount: number | undefined): Promise<void> {
    try {
      const result = await this.trigger(type, username, { test: false, amount });
      this.logger.log(
        `Alerta ${type} de @${username}: ${result.delivered ? 'enviada' : `omitida (${result.reason})`}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo procesar la alerta ${type} de @${username}: ${message}`);
    }
  }

  /** Genera la alerta y la manda al overlay. `test` salta el interruptor "activada" y la antirrepetición. */
  async trigger(type: AlertType, username: string, options: TriggerOptions): Promise<TriggerResult> {
    const config = await this.getConfig(type);
    if (!options.test && !config.enabled) {
      return { delivered: false, reason: 'disabled' };
    }
    if (!this.presence.hasAlertListeners()) {
      return { delivered: false, reason: 'no-overlay' };
    }

    if (!options.test) {
      if (this.blockedWords.isBlocked(username)) {
        return { delivered: false, reason: 'blocked-name' };
      }
      if (type === 'kicks' && (options.amount ?? 0) < config.minAmount) {
        return { delivered: false, reason: 'below-minimum' };
      }
      // Solo los seguidores se limitan: cada propina o suscripción merece su alerta.
      if (type === 'follow') {
        const last = this.recentFollowers.get(username.toLowerCase());
        if (last && Date.now() - last < REPEAT_FOLLOW_WINDOW_MS) {
          return { delivered: false, reason: 'repeat' };
        }
        this.recentFollowers.set(username.toLowerCase(), Date.now());
      }
    }

    const amount = options.amount ?? 1;

    const tts = config.ttsEnabled ? await this.synthesize(config, username, amount) : null;

    const payload: AlertPlayPayload = {
      id: randomUUID(),
      kind: type,
      username,
      text: this.render(config.textTemplate, username, amount),
      textParts: this.renderParts(config.textTemplate, username, amount),
      variableColor: config.variableColor,
      imageFile: config.imageFile,
      audioFile: config.audioFile,
      ttsAudioBase64: tts?.audioBase64 ?? null,
      ttsMimeType: tts?.mimeType ?? null,
      ttsPitch: tts?.pitch ?? 0,
      normalize: this.settingsService.get().normalizeVolume,
      durationSeconds: config.durationSeconds,
      volume: this.settingsService.get().volume,
      style: {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        textColor: config.textColor,
        outlineColor: config.outlineColor,
        outlineWidth: config.outlineWidth,
      },
    };
    this.eventEmitter.emit(AlertsInternalEvent.PLAY, payload);
    return { delivered: true };
  }

  private async synthesize(
    config: AlertConfig,
    username: string,
    amount: number,
  ): Promise<{ audioBase64: string; mimeType: string; pitch: number } | null> {
    const text = this.render(config.ttsTemplate, username, amount).slice(0, MAX_TTS_CHARS);
    return this.synthesizeText(text, config.voiceProfileId);
  }

  private async synthesizeText(
    text: string,
    voiceProfileId: string | null,
  ): Promise<{ audioBase64: string; mimeType: string; pitch: number } | null> {
    if (!this.spendTracker.tryConsume(text.length, this.settingsService.get().dailyCharCap)) {
      this.logger.warn('Tope diario de caracteres alcanzado: la alerta sale sin voz');
      return null;
    }

    const voice = await this.resolveVoice(voiceProfileId);
    if (!voice) {
      this.logger.warn('No hay ninguna voz configurada: la alerta sale sin voz');
      return null;
    }

    try {
      const { audio, mimeType } = await this.ttsProvider.synthesize(text, {
        fishVoiceId: voice.fishVoiceId,
        speed: voice.speed,
        pitch: voice.pitch,
      });
      return { audioBase64: audio.toString('base64'), mimeType, pitch: voice.pitch };
    } catch (error) {
      if (error instanceof TtsInsufficientBalanceError) {
        this.eventEmitter.emit(TtsInternalEvent.OUT_OF_BALANCE, { message: error.message });
      }
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`TTS de la alerta falló: ${message}`);
      return null;
    }
  }

  private async resolveVoice(voiceProfileId: string | null): Promise<VoiceProfile | null> {
    if (voiceProfileId) {
      const chosen = await this.prisma.voiceProfile.findUnique({ where: { id: voiceProfileId } });
      if (chosen) {
        return chosen;
      }
    }
    return this.prisma.voiceProfile.findFirst({ where: { isDefault: true } });
  }

  private render(template: string, username: string, amount: number): string {
    return template.replace(/\{usuario\}/gi, username).replace(/\{cantidad\}/gi, String(amount));
  }

  /** Igual que render(), pero separando las variables para que el overlay les ponga su color. */
  private renderParts(template: string, username: string, amount: number): AlertTextPart[] {
    return template
      .split(/(\{usuario\}|\{cantidad\})/gi)
      .filter((piece) => piece.length > 0)
      .map((piece) => {
        const name = piece.toLowerCase();
        if (name === '{usuario}') {
          return { text: username, variable: true };
        }
        if (name === '{cantidad}') {
          return { text: String(amount), variable: true };
        }
        return { text: piece, variable: false };
      });
  }

  private async deleteFile(file: string | null): Promise<void> {
    if (!file) {
      return;
    }
    await unlink(join(this.dir, file)).catch(() => undefined);
  }
}
