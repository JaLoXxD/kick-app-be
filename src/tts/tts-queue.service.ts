import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { SettingsService } from '../settings/settings.service';
import { OverlayPresenceService } from './overlay-presence.service';
import {
  TTS_PROVIDER,
  TtsInsufficientBalanceError,
  TtsProvider,
  TtsVoiceOptions,
} from './tts.provider';

export const TtsInternalEvent = {
  JOB_READY: 'tts.job.ready',
  QUEUE_UPDATED: 'tts.queue.updated',
  OUT_OF_BALANCE: 'tts.out-of-balance',
  /** Qué mensaje se está leyendo ahora (payload `NowPlaying`) o `null` al terminar. */
  NOW_PLAYING: 'tts.now-playing',
  /** El streamer saltó el mensaje en curso: el overlay debe cortar el audio. */
  SKIP: 'tts.skip',
  /** Cambió el estado del control rápido (pausa, último silenciado): payload `TtsControlState`. */
  CONTROL: 'tts.control',
} as const;

/** Tope de seguridad: si el overlay nunca confirma el fin de la reproducción
 * (por ejemplo, porque no está abierto en OBS), la cola avanza igualmente. */
const PLAYBACK_SAFETY_TIMEOUT_MS = 20_000;

export interface EnqueueTtsJobInput {
  username: string;
  nickname: string;
  text: string;
  voiceName: string;
  /** Volumen propio del usuario (0-100), se multiplica por el volumen global. */
  volume?: number;
  voice: TtsVoiceOptions;
}

export interface TtsJobReadyPayload {
  jobId: string;
  username: string;
  nickname: string;
  text: string;
  voiceName: string;
  audioBase64: string;
  mimeType: string;
  /** Volumen de reproducción 0-100, tomado de los ajustes al generar el audio. */
  volume: number;
  /** Tono en semitonos que el overlay aplica al reproducir. */
  pitch: number;
  /** El overlay iguala la sonoridad de la voz antes de reproducirla. */
  normalize: boolean;
}

export interface NowPlaying {
  jobId: string;
  username: string;
  nickname: string;
  text: string;
}

interface QueuedJob extends EnqueueTtsJobInput {
  id: string;
}

@Injectable()
export class TtsQueueService {
  private readonly logger = new Logger(TtsQueueService.name);
  private readonly queue: QueuedJob[] = [];
  private currentJobId: string | null = null;
  /** El mensaje que ya llegó al overlay (null mientras se sintetiza o si no hay ninguno). */
  private nowPlaying: NowPlaying | null = null;
  private safetyTimeout: NodeJS.Timeout | null = null;

  constructor(
    @Inject(TTS_PROVIDER) private readonly ttsProvider: TtsProvider,
    private readonly eventEmitter: EventEmitter2,
    private readonly presence: OverlayPresenceService,
    private readonly settingsService: SettingsService,
  ) {}

  enqueue(input: EnqueueTtsJobInput): string {
    const id = randomUUID();
    if (!this.presence.hasListeners()) {
      // Sin overlay abierto nadie lo escucharía y la síntesis se cobra: se descarta.
      this.logger.debug(`Sin overlay conectado, se omite el audio de @${input.username}`);
      return id;
    }
    this.queue.push({ id, ...input });
    this.emitQueueUpdated();
    void this.processNext();
    return id;
  }

  /** Debe llamarse cuando el overlay (Angular) confirma que terminó de reproducir un audio. */
  onPlaybackFinished(jobId: string): void {
    if (jobId !== this.currentJobId) {
      return;
    }
    this.clearCurrentJob();
    void this.processNext();
  }

  getNowPlaying(): NowPlaying | null {
    return this.nowPlaying;
  }

  /**
   * Corta el mensaje que se está leyendo y pasa al siguiente. Con `dropSameUser` descarta antes los mensajes
   * en espera de su autor, para que el siguiente en sonar no sea otro suyo. Devuelve null si no había nada.
   */
  skipCurrent(dropSameUser = false): (NowPlaying & { dropped: number }) | null {
    const skipped = this.nowPlaying;
    if (!skipped || skipped.jobId !== this.currentJobId) {
      return null;
    }
    const dropped = dropSameUser ? this.removeQueuedFrom(skipped.username) : 0;
    this.eventEmitter.emit(TtsInternalEvent.SKIP, { jobId: skipped.jobId });
    this.clearCurrentJob();
    void this.processNext();
    return { ...skipped, dropped };
  }

  /** Vacía la cola de mensajes en espera (sin tocar el que suena). Devuelve cuántos descartó. */
  clearQueued(): number {
    const dropped = this.queue.length;
    this.queue.length = 0;
    if (dropped > 0) {
      this.emitQueueUpdated();
    }
    return dropped;
  }

  /** Quita de la cola los mensajes pendientes de un usuario (sin tocar el que suena). */
  removeQueuedFrom(username: string): number {
    const before = this.queue.length;
    const remaining = this.queue.filter((job) => job.username.toLowerCase() !== username.toLowerCase());
    this.queue.length = 0;
    this.queue.push(...remaining);
    if (this.queue.length !== before) {
      this.emitQueueUpdated();
    }
    return before - this.queue.length;
  }

  getQueueLength(): number {
    return this.queue.length + (this.currentJobId ? 1 : 0);
  }

  private async processNext(): Promise<void> {
    if (this.currentJobId || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.currentJobId = job.id;
    this.emitQueueUpdated();

    try {
      const { audio, mimeType } = await this.ttsProvider.synthesize(job.text, job.voice);
      this.eventEmitter.emit(TtsInternalEvent.JOB_READY, {
        jobId: job.id,
        username: job.username,
        nickname: job.nickname,
        text: job.text,
        voiceName: job.voiceName,
        audioBase64: audio.toString('base64'),
        mimeType,
        volume: Math.round((this.settingsService.get().volume * (job.volume ?? 100)) / 100),
        pitch: job.voice.pitch,
        normalize: this.settingsService.get().normalizeVolume,
      } satisfies TtsJobReadyPayload);
      this.nowPlaying = { jobId: job.id, username: job.username, nickname: job.nickname, text: job.text };
      this.eventEmitter.emit(TtsInternalEvent.NOW_PLAYING, this.nowPlaying);

      this.safetyTimeout = setTimeout(() => {
        this.logger.warn(`Job ${job.id} nunca recibió confirmación de fin de reproducción`);
        this.onPlaybackFinished(job.id);
      }, PLAYBACK_SAFETY_TIMEOUT_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown TTS error';
      this.logger.error(`Fallo al sintetizar el mensaje de ${job.username}: ${message}`);
      if (error instanceof TtsInsufficientBalanceError) {
        // Sin saldo no tiene sentido seguir intentando con el resto de la cola.
        this.queue.length = 0;
        this.eventEmitter.emit(TtsInternalEvent.OUT_OF_BALANCE, { message });
      }
      this.clearCurrentJob();
      void this.processNext();
    }
  }

  private clearCurrentJob(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
    this.currentJobId = null;
    if (this.nowPlaying) {
      this.nowPlaying = null;
      this.eventEmitter.emit(TtsInternalEvent.NOW_PLAYING, null);
    }
    this.emitQueueUpdated();
  }

  private emitQueueUpdated(): void {
    this.eventEmitter.emit(TtsInternalEvent.QUEUE_UPDATED, {
      length: this.getQueueLength(),
    });
  }
}
