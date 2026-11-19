import { Injectable, Logger } from '@nestjs/common';
import { KickAuthService } from './kick-auth.service';

const API = 'https://api.kick.com/public/v1';
const CACHE_MS = 60_000;

export interface KickLeaderboardEntry {
  username: string;
  total: number;
}

export interface KickLeaderboard {
  lifetime: KickLeaderboardEntry[];
  month: KickLeaderboardEntry[];
  week: KickLeaderboardEntry[];
}

export interface KickSubscriberStats {
  active: number;
  gifted: number;
  canceled: number;
}

interface Cached<T> {
  value: T | null;
  expiresAt: number;
}

/** Datos de solo lectura de la API pública de Kick (ranking de KICKs y suscriptores del canal), con caché corta. */
@Injectable()
export class KickApiService {
  private readonly logger = new Logger(KickApiService.name);
  private leaderboard: Cached<KickLeaderboard> | null = null;
  private stats: Cached<KickSubscriberStats> | null = null;
  private readonly warned = new Set<string>();

  constructor(private readonly authService: KickAuthService) {}

  /** Ranking de KICKs de Kick (siempre / mes / semana). Necesita el permiso kicks:read; sin él devuelve null. */
  async getKicksLeaderboard(): Promise<KickLeaderboard | null> {
    if (this.leaderboard && this.leaderboard.expiresAt > Date.now()) {
      return this.leaderboard.value;
    }
    const body = await this.get<{
      data?: Record<'lifetime' | 'month' | 'week', { username?: string; gifted_amount?: number }[] | undefined>;
    }>('/kicks/leaderboard?top=100', 'leaderboard');
    const map = (rows: { username?: string; gifted_amount?: number }[] | undefined): KickLeaderboardEntry[] =>
      (rows ?? [])
        .filter((row) => row.username)
        .map((row) => ({ username: row.username as string, total: Number(row.gifted_amount) || 0 }));
    const value = body?.data
      ? { lifetime: map(body.data.lifetime), month: map(body.data.month), week: map(body.data.week) }
      : null;
    this.leaderboard = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }

  /** Suscriptores activos, regalados activos y cancelados del canal. */
  async getSubscriberStats(): Promise<KickSubscriberStats | null> {
    if (this.stats && this.stats.expiresAt > Date.now()) {
      return this.stats.value;
    }
    const body = await this.get<{
      data?: {
        active_subscribers_count?: number;
        active_gifted_subscribers_count?: number;
        canceled_subscribers_count?: number;
      }[];
    }>('/channels', 'channels');
    const channel = body?.data?.[0];
    const value =
      channel && typeof channel.active_subscribers_count === 'number'
        ? {
            active: channel.active_subscribers_count,
            gifted: channel.active_gifted_subscribers_count ?? 0,
            canceled: channel.canceled_subscribers_count ?? 0,
          }
        : null;
    this.stats = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }

  /** Fuerza a releer el ranking en la próxima consulta (p. ej. tras recibir KICKs). */
  invalidateLeaderboard(): void {
    this.leaderboard = null;
  }

  private async get<T>(path: string, label: string): Promise<T | null> {
    try {
      if (!(await this.authService.isAuthenticated())) {
        return null;
      }
      const response = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${await this.authService.getAccessToken()}` },
      });
      if (!response.ok) {
        if (!this.warned.has(label)) {
          this.warned.add(label);
          this.logger.warn(
            `Kick respondió ${response.status} al pedir ${label}${response.status === 403 ? ' (¿falta el permiso kicks:read? hay que reautorizar con Kick)' : ''}`,
          );
        }
        return null;
      }
      this.warned.delete(label);
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(`No se pudo leer ${label} de Kick: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }
}
