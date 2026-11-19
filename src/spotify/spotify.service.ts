import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SpotifyConfig, SpotifyRequest } from '@prisma/client';
import { KickChatService } from '../kick/kick-chat.service';
import { KickChatEvent, KickInternalEvent } from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSpotifyConfigDto } from './dto/update-spotify-config.dto';
import { PlaybackState, SpotifyApiService, SpotifyTrack } from './spotify-api.service';
import { SpotifyAuthService } from './spotify-auth.service';

const CONFIG_ID = 'app';
const TICK_MS = 5_000;
/** Tras un fallo al encolar (sin dispositivo, etc.) se espera antes de reintentar. */
const RETRY_AFTER_FAILURE_MS = 30_000;
const EMOTE_PATTERN = /\[emote:\d+:[^\]]*\]/g;
const ARTIST_SEPARATOR = /\s+[-–—|/]\s+/;
const URI_OR_LINK = /spotify\.com\/|spotify:track:/i;
const ACTIVITY_LIMIT = 30;
/** Estados que cuentan para el límite por usuario: lo revocado o fallido no gasta el turno. */
const COUNTED_STATUSES = ['pending', 'sent', 'played'];

export interface SpotifyActivity {
  at: string;
  username: string;
  message: string;
  ok: boolean;
}

export interface RequestOutcome {
  ok: boolean;
  message: string;
}

export interface SpotifyStatus {
  configured: boolean;
  connected: boolean;
  displayName: string | null;
  product: string | null;
  playback: PlaybackState | null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? '1 minuto' : `${minutes} minutos`;
}

/**
 * Peticiones de canciones por chat. Spotify no permite quitar elementos de su cola, así que las
 * peticiones esperan en la cola propia (base de datos) y solo se pasan a Spotify cuando la canción
 * actual está por terminar; mientras tanto `!revoke` puede cancelarlas.
 */
@Injectable()
export class SpotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SpotifyService.name);
  private config: SpotifyConfig | null = null;
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private retryAt = 0;
  private readonly activity: SpotifyActivity[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: SpotifyAuthService,
    private readonly api: SpotifyApiService,
    private readonly kickChat: KickChatService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getConfig();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // ---------------------------------------------------------------- ajustes

  async getConfig(): Promise<SpotifyConfig> {
    this.config ??= await this.prisma.spotifyConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID },
      update: {},
    });
    return this.config;
  }

  async updateConfig(dto: UpdateSpotifyConfigDto): Promise<SpotifyConfig> {
    await this.getConfig();
    // El DTO transformado puede traer claves con `undefined`; no deben pisar los valores actuales.
    const normalized = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateSpotifyConfigDto;
    for (const key of ['playCommand', 'revokeCommand'] as const) {
      if (normalized[key] !== undefined) {
        normalized[key] = normalized[key]!.toLowerCase();
      }
    }
    const next = { ...(this.config as SpotifyConfig), ...normalized };
    if (next.playCommand === next.revokeCommand) {
      throw new Error('Los comandos de pedir y de quitar deben ser distintos');
    }
    this.config = await this.prisma.spotifyConfig.update({ where: { id: CONFIG_ID }, data: normalized });
    return this.config;
  }

  // ---------------------------------------------------------------- estado

  async getStatus(): Promise<SpotifyStatus> {
    const row = await this.auth.getAuth();
    return {
      configured: this.auth.isConfigured(),
      connected: row !== null,
      displayName: row?.displayName ?? null,
      product: row?.product ?? null,
      playback: row ? await this.api.getPlayback() : null,
    };
  }

  async getQueueView(): Promise<{
    pending: SpotifyRequest[];
    recent: SpotifyRequest[];
    activity: SpotifyActivity[];
  }> {
    const [pending, recent] = await Promise.all([
      this.prisma.spotifyRequest.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }),
      this.prisma.spotifyRequest.findMany({
        where: { status: { not: 'pending' } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);
    return { pending, recent, activity: [...this.activity].reverse() };
  }

  // ---------------------------------------------------------------- chat

  /** ¿Es un comando de música? Se usa para que el TTS no los lea en voz alta. */
  isCommand(text: string): boolean {
    const config = this.config;
    if (!config?.enabled) {
      return false;
    }
    const lower = text.trim().toLowerCase();
    return [config.playCommand, config.revokeCommand].some(
      (command) => lower === command || lower.startsWith(`${command} `),
    );
  }

  @OnEvent(KickInternalEvent.CHAT)
  async handleChat(event: KickChatEvent): Promise<void> {
    const config = this.config;
    if (!config?.enabled) {
      return;
    }
    const text = event.text.replace(EMOTE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    const lower = text.toLowerCase();

    let outcome: RequestOutcome | null = null;
    try {
      if (lower === config.playCommand || lower.startsWith(`${config.playCommand} `)) {
        outcome = await this.requestSong(event.username, text.slice(config.playCommand.length));
      } else if (lower === config.revokeCommand || lower.startsWith(`${config.revokeCommand} `)) {
        outcome = await this.revoke(event.username);
      }
    } catch (error) {
      this.logger.error(`Error con el comando de @${event.username}: ${error instanceof Error ? error.message : error}`);
      outcome = { ok: false, message: 'Ocurrió un error con Spotify, intenta de nuevo' };
    }
    if (outcome) {
      this.record(event.username, outcome);
      if (config.replyInChat) {
        void this.kickChat.send(`@${event.username} ${outcome.message}`);
      }
    }
  }

  /** Busca la canción, valida las reglas y la deja en la cola propia. */
  async requestSong(username: string, rawArgs: string, bypassLimits = false): Promise<RequestOutcome> {
    const config = await this.getConfig();
    const args = rawArgs.trim();
    if (!args) {
      return { ok: false, message: `Uso: ${config.playCommand} canción - artista (el artista es opcional)` };
    }
    if (!(await this.auth.getAuth())) {
      return { ok: false, message: 'Spotify no está conectado en este canal' };
    }

    if (!bypassLimits) {
      const blocked = await this.checkLimits(username, config);
      if (blocked) {
        return { ok: false, message: blocked };
      }
    }

    const [query, artist] = URI_OR_LINK.test(args) ? [args, undefined] : this.splitArgs(args);
    const found = await this.api.search(query, artist);
    if (found.length === 0) {
      return { ok: false, message: `No encontré "${args}" en Spotify` };
    }
    const track = found.find((candidate) => this.rejection(candidate, config) === null);
    if (!track) {
      return { ok: false, message: `No se permite pedir esa canción (${this.rejection(found[0], config)})` };
    }

    const duplicate = await this.prisma.spotifyRequest.findFirst({
      where: { trackUri: track.uri, status: { in: ['pending', 'sent'] } },
    });
    if (duplicate) {
      return { ok: false, message: `"${track.name}" ya está en la cola` };
    }

    await this.prisma.spotifyRequest.create({
      data: {
        username,
        trackUri: track.uri,
        trackName: track.name,
        artists: track.artists,
        durationMs: track.durationMs,
      },
    });
    const position = await this.prisma.spotifyRequest.count({ where: { status: 'pending' } });
    return { ok: true, message: `✅ Añadida: ${track.name} — ${track.artists} (en espera #${position})` };
  }

  /** `!revoke`: quita la última petición del usuario que aún espera en la cola del bot. */
  async revoke(username: string): Promise<RequestOutcome> {
    const own = { username: { equals: username, mode: 'insensitive' as const } };
    const pending = await this.prisma.spotifyRequest.findFirst({
      where: { ...own, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      await this.prisma.spotifyRequest.update({ where: { id: pending.id }, data: { status: 'revoked' } });
      return { ok: true, message: `🗑️ Quité "${pending.trackName}" de la cola` };
    }
    const sent = await this.prisma.spotifyRequest.findFirst({
      where: { ...own, status: 'sent' },
      orderBy: { createdAt: 'desc' },
    });
    if (sent) {
      return { ok: false, message: `"${sent.trackName}" ya está en la cola de Spotify y no se puede quitar` };
    }
    return { ok: false, message: 'No tienes ninguna canción en espera' };
  }

  // ---------------------------------------------------------------- administración

  async removeRequest(id: string): Promise<void> {
    await this.prisma.spotifyRequest.updateMany({ where: { id, status: 'pending' }, data: { status: 'removed' } });
  }

  async clearPending(): Promise<void> {
    await this.prisma.spotifyRequest.updateMany({ where: { status: 'pending' }, data: { status: 'removed' } });
  }

  skip(): Promise<boolean> {
    return this.api.skipNext();
  }

  // ---------------------------------------------------------------- reglas

  private splitArgs(args: string): [string, string | undefined] {
    const parts = args.split(ARTIST_SEPARATOR);
    if (parts.length < 2 || !parts[0].trim() || !parts[1].trim()) {
      return [args, undefined];
    }
    return [parts[0].trim(), parts.slice(1).join(' ').trim()];
  }

  private async checkLimits(username: string, config: SpotifyConfig): Promise<string | null> {
    const now = Date.now();
    if (config.perUserWindowMinutes > 0) {
      const last = await this.prisma.spotifyRequest.findFirst({
        where: {
          username: { equals: username, mode: 'insensitive' },
          status: { in: COUNTED_STATUSES },
          createdAt: { gt: new Date(now - config.perUserWindowMinutes * 60_000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (last) {
        const wait = last.createdAt.getTime() + config.perUserWindowMinutes * 60_000 - now;
        return `Ya pediste una canción, podrás pedir otra en ${formatWait(wait)}`;
      }
    }
    if (config.minGapMinutes > 0) {
      const last = await this.prisma.spotifyRequest.findFirst({
        where: {
          status: { in: COUNTED_STATUSES },
          createdAt: { gt: new Date(now - config.minGapMinutes * 60_000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (last) {
        const wait = last.createdAt.getTime() + config.minGapMinutes * 60_000 - now;
        return `Hay que esperar ${formatWait(wait)} entre canciones`;
      }
    }
    const waiting = await this.prisma.spotifyRequest.count({ where: { status: 'pending' } });
    if (waiting >= config.maxQueueSize) {
      return 'La cola de canciones está llena, intenta más tarde';
    }
    return null;
  }

  /** Motivo por el que una canción no se acepta, o null si cumple las reglas. */
  private rejection(track: SpotifyTrack, config: SpotifyConfig): string | null {
    if (config.blockExplicit && track.explicit) {
      return 'contenido explícito';
    }
    if (config.maxDurationSeconds > 0 && track.durationMs > config.maxDurationSeconds * 1000) {
      return 'dura demasiado';
    }
    const haystack = normalize(`${track.name} ${track.artists}`);
    if (config.blockedTerms.some((term) => term.trim() && haystack.includes(normalize(term)))) {
      return 'está en la lista bloqueada';
    }
    return null;
  }

  // ---------------------------------------------------------------- envío a Spotify

  /** Cada pocos segundos: si la canción actual está por terminar, pasa la siguiente petición a Spotify. */
  private async tick(): Promise<void> {
    if (this.ticking || !this.config?.enabled || Date.now() < this.retryAt) {
      return;
    }
    this.ticking = true;
    try {
      const [sent, next] = await Promise.all([
        this.prisma.spotifyRequest.findFirst({ where: { status: 'sent' }, orderBy: { sentAt: 'desc' } }),
        this.prisma.spotifyRequest.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }),
      ]);
      if ((!sent && !next) || !(await this.auth.getAuth())) {
        return;
      }

      const playback = await this.api.getPlayback();
      if (!playback) {
        return;
      }

      if (sent) {
        if (playback.trackUri !== sent.trackUri) {
          const queue = await this.api.getQueueUris();
          if (queue === null || queue.includes(sent.trackUri)) {
            return; // sigue esperando su turno en Spotify
          }
        }
        // Ya sonó (o la saltaron): se puede enviar la siguiente.
        await this.prisma.spotifyRequest.updateMany({ where: { status: 'sent' }, data: { status: 'played' } });
      }

      if (!next || !playback.active || !playback.trackUri) {
        return;
      }
      const remainingMs = playback.durationMs - playback.progressMs;
      if (remainingMs > this.config.leadSeconds * 1000) {
        return;
      }

      const result = await this.api.addToQueue(next.trackUri);
      if (result.ok) {
        await this.prisma.spotifyRequest.update({
          where: { id: next.id },
          data: { status: 'sent', sentAt: new Date() },
        });
        this.record('bot', { ok: true, message: `Enviada a Spotify: ${next.trackName} (pedida por @${next.username})` });
        return;
      }
      this.retryAt = Date.now() + RETRY_AFTER_FAILURE_MS;
      this.record('bot', { ok: false, message: this.failureMessage(result.reason) });
    } catch (error) {
      this.logger.error(`Error en el ciclo de Spotify: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.ticking = false;
    }
  }

  private failureMessage(reason: 'no-device' | 'premium' | 'auth' | 'rate' | 'error'): string {
    switch (reason) {
      case 'no-device':
        return 'No pude encolar: Spotify no tiene un dispositivo activo (abre Spotify y reproduce algo)';
      case 'premium':
        return 'No pude encolar: Spotify exige una cuenta Premium para controlar la cola';
      case 'auth':
        return 'No pude encolar: vuelve a conectar Spotify';
      case 'rate':
        return 'Spotify limitó las llamadas temporalmente, se reintenta solo';
      default:
        return 'Spotify rechazó añadir la canción a la cola';
    }
  }

  private record(username: string, outcome: RequestOutcome): void {
    this.activity.push({ at: new Date().toISOString(), username, message: outcome.message, ok: outcome.ok });
    if (this.activity.length > ACTIVITY_LIMIT) {
      this.activity.shift();
    }
  }
}
