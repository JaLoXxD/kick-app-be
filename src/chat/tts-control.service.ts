import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../config/configuration';
import { NowPlaying, TtsInternalEvent, TtsQueueService } from '../tts/tts-queue.service';
import { MutedUsersService } from './muted-users.service';

export interface TtsControlState {
  /** El TTS está en pausa: el chat sigue en pantalla pero nada se lee. */
  paused: boolean;
  /** Último usuario silenciado desde el control rápido (para deshacerlo). */
  lastMuted: string | null;
}

export interface SkipTtsResult {
  skipped: boolean;
  username: string | null;
  muted: boolean;
  /** Mensajes en espera de ese usuario que se descartaron. */
  dropped: number;
}

export interface TtsControlStatus extends TtsControlState {
  nowPlaying: NowPlaying | null;
  queued: number;
}

/**
 * Control rápido del TTS: saltar el mensaje en curso, silenciar a su autor, pausar toda la lectura y
 * deshacer el último silencio. Lo usan el panel y los atajos externos (Stream Deck, macros, el móvil).
 */
@Injectable()
export class TtsControlService {
  private paused = false;
  private lastMuted: string | null = null;

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly queue: TtsQueueService,
    private readonly mutedUsers: MutedUsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ---------------------------------------------------------------- token de los atajos

  /** Token de los atajos externos: se deriva del secreto del servidor, así no hay nada más que configurar. */
  getControlToken(): string {
    const { jwtSecret } = this.configService.get('auth', { infer: true });
    if (!jwtSecret) {
      throw new ServiceUnavailableException('JWT_SECRET no está configurado');
    }
    return createHmac('sha256', jwtSecret).update('kick-tts-remote-control-v1').digest('hex').slice(0, 40);
  }

  isValidControlToken(token: string | undefined): boolean {
    if (!token) {
      return false;
    }
    const expected = Buffer.from(this.getControlToken());
    const given = Buffer.from(token);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  // ---------------------------------------------------------------- estado

  isPaused(): boolean {
    return this.paused;
  }

  state(): TtsControlState {
    return { paused: this.paused, lastMuted: this.lastMuted };
  }

  status(): TtsControlStatus {
    return { ...this.state(), nowPlaying: this.queue.getNowPlaying(), queued: this.queue.getQueueLength() };
  }

  private publish(): TtsControlState {
    const state = this.state();
    this.eventEmitter.emit(TtsInternalEvent.CONTROL, state);
    return state;
  }

  // ---------------------------------------------------------------- acciones

  /** Corta el mensaje que se está leyendo; con `muteUser` además silencia a su autor y borra sus mensajes en espera. */
  async skip(muteUser: boolean): Promise<SkipTtsResult> {
    const current = this.queue.getNowPlaying();
    if (!current) {
      return { skipped: false, username: null, muted: false, dropped: 0 };
    }
    // Primero se silencia (así nada nuevo suyo entra) y luego se corta, descartando lo que tenga en espera.
    if (muteUser) {
      await this.mutedUsers.mute(current.username);
      this.lastMuted = current.username;
    }
    const skipped = this.queue.skipCurrent(muteUser);
    if (muteUser) {
      this.publish();
    }
    if (!skipped) {
      return { skipped: false, username: null, muted: muteUser, dropped: 0 };
    }
    return { skipped: true, username: skipped.username, muted: muteUser, dropped: skipped.dropped };
  }

  /** Pausa o reanuda la lectura. Al pausar también se corta lo que suena y se vacía la cola. */
  setPaused(paused: boolean): TtsControlState {
    this.paused = paused;
    if (paused) {
      this.queue.clearQueued();
      this.queue.skipCurrent(false);
    }
    return this.publish();
  }

  /** Quita el silencio al último usuario silenciado desde el control rápido. */
  async unmuteLast(): Promise<{ username: string | null }> {
    const username = this.lastMuted;
    if (!username) {
      return { username: null };
    }
    await this.mutedUsers.unmute(username);
    this.lastMuted = null;
    this.publish();
    return { username };
  }
}
