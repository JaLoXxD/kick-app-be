import { Injectable, Logger } from '@nestjs/common';
import { SpotifyAuthService } from './spotify-auth.service';

const API = 'https://api.spotify.com/v1';

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: string;
  durationMs: number;
  explicit: boolean;
}

export interface PlaybackState {
  /** Hay un dispositivo activo con algo cargado. */
  active: boolean;
  isPlaying: boolean;
  trackUri: string | null;
  trackName: string | null;
  artists: string | null;
  progressMs: number;
  durationMs: number;
  deviceName: string | null;
}

export type QueueResult = { ok: true } | { ok: false; reason: 'no-device' | 'premium' | 'auth' | 'rate' | 'error' };

interface RawTrack {
  uri: string;
  name: string;
  duration_ms: number;
  explicit?: boolean;
  artists?: { name: string }[];
}

const TRACK_ID = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/;

function toTrack(raw: RawTrack): SpotifyTrack {
  return {
    uri: raw.uri,
    name: raw.name,
    artists: (raw.artists ?? []).map((artist) => artist.name).join(', '),
    durationMs: raw.duration_ms,
    explicit: Boolean(raw.explicit),
  };
}

/** Cliente mínimo de la API web de Spotify con refresh de token y espera ante 429. */
@Injectable()
export class SpotifyApiService {
  private readonly logger = new Logger(SpotifyApiService.name);
  /** Si Spotify limita las llamadas (429), no se vuelve a llamar hasta esta hora. */
  private blockedUntil = 0;

  constructor(private readonly auth: SpotifyAuthService) {}

  isRateLimited(): boolean {
    return Date.now() < this.blockedUntil;
  }

  /** Busca canciones; acepta también un enlace o URI de una canción. */
  async search(query: string, artist?: string): Promise<SpotifyTrack[]> {
    const linked = query.match(TRACK_ID);
    if (linked) {
      const response = await this.call('GET', `/tracks/${linked[1]}`);
      return response?.ok ? [toTrack((await response.json()) as RawTrack)] : [];
    }

    const queries = artist
      ? [`track:${query} artist:${artist}`, `${query} ${artist}`]
      : [query];
    for (const q of queries) {
      const params = new URLSearchParams({ q, type: 'track', limit: '5' });
      const response = await this.call('GET', `/search?${params.toString()}`);
      if (!response?.ok) {
        continue;
      }
      const body = (await response.json()) as { tracks?: { items?: RawTrack[] } };
      const items = (body.tracks?.items ?? []).filter(Boolean).map(toTrack);
      if (items.length > 0) {
        return items;
      }
    }
    return [];
  }

  async addToQueue(uri: string): Promise<QueueResult> {
    const response = await this.call('POST', `/me/player/queue?uri=${encodeURIComponent(uri)}`);
    if (!response) {
      return { ok: false, reason: this.isRateLimited() ? 'rate' : 'auth' };
    }
    if (response.ok) {
      return { ok: true };
    }
    const detail = await response.text().catch(() => '');
    this.logger.warn(`No se pudo encolar en Spotify (${response.status}): ${detail.slice(0, 200)}`);
    if (response.status === 404) return { ok: false, reason: 'no-device' };
    if (response.status === 403) return { ok: false, reason: 'premium' };
    if (response.status === 401) return { ok: false, reason: 'auth' };
    if (response.status === 429) return { ok: false, reason: 'rate' };
    return { ok: false, reason: 'error' };
  }

  async skipNext(): Promise<boolean> {
    const response = await this.call('POST', '/me/player/next');
    return Boolean(response?.ok);
  }

  /** Estado de reproducción; null si no hay sesión o la API falló. */
  async getPlayback(): Promise<PlaybackState | null> {
    const response = await this.call('GET', '/me/player');
    if (!response) {
      return null;
    }
    const empty: PlaybackState = {
      active: false,
      isPlaying: false,
      trackUri: null,
      trackName: null,
      artists: null,
      progressMs: 0,
      durationMs: 0,
      deviceName: null,
    };
    if (response.status === 204) {
      return empty;
    }
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as {
      is_playing?: boolean;
      progress_ms?: number | null;
      item?: (RawTrack & { type?: string }) | null;
      device?: { name?: string } | null;
    };
    const item = body.item ?? null;
    return {
      active: Boolean(body.device),
      isPlaying: Boolean(body.is_playing),
      trackUri: item?.uri ?? null,
      trackName: item?.name ?? null,
      artists: item ? (item.artists ?? []).map((artist) => artist.name).join(', ') : null,
      progressMs: body.progress_ms ?? 0,
      durationMs: item?.duration_ms ?? 0,
      deviceName: body.device?.name ?? null,
    };
  }

  /** URIs de lo que sigue en la cola de Spotify. */
  async getQueueUris(): Promise<string[] | null> {
    const response = await this.call('GET', '/me/player/queue');
    if (!response?.ok) {
      return null;
    }
    const body = (await response.json()) as { queue?: { uri: string }[] };
    return (body.queue ?? []).map((item) => item.uri);
  }

  /** Llama a la API; null si no hay sesión. Reintenta una vez tras un 401 (token revocado/vencido). */
  private async call(method: string, path: string, retried = false): Promise<Response | null> {
    if (this.isRateLimited()) {
      return null;
    }
    const token = await this.auth.getAccessToken();
    if (!token) {
      return null;
    }
    const response = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401 && !retried) {
      await this.auth.forceRefresh().catch(() => null);
      return this.call(method, path, true);
    }
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') ?? '5');
      this.blockedUntil = Date.now() + (Number.isFinite(wait) ? wait : 5) * 1000;
      this.logger.warn(`Spotify limitó las llamadas; se pausa ${wait}s`);
    }
    return response;
  }
}
