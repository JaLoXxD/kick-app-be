import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpotifyAuth } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const ME_URL = 'https://api.spotify.com/v1/me';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const AUTH_ROW_ID = 'streamer';
const REFRESH_MARGIN_MS = 60_000;
const PENDING_LOGIN_TTL_MS = 10 * 60_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

/** Login con Spotify (Authorization Code + PKCE: no necesita client secret). */
@Injectable()
export class SpotifyAuthService {
  private readonly logger = new Logger(SpotifyAuthService.name);
  private readonly pendingLogins = new Map<string, { verifier: string; createdAt: number }>();
  private refreshing: Promise<string> | null = null;

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    const { clientId, redirectUri } = this.configService.get('spotify', { infer: true });
    return Boolean(clientId && redirectUri);
  }

  buildLoginUrl(): string {
    const { clientId, redirectUri } = this.requireConfig();
    const now = Date.now();
    for (const [state, { createdAt }] of this.pendingLogins) {
      if (now - createdAt > PENDING_LOGIN_TTL_MS) {
        this.pendingLogins.delete(state);
      }
    }

    const verifier = randomBytes(48).toString('base64url');
    const state = randomBytes(16).toString('hex');
    this.pendingLogins.set(state, { verifier, createdAt: now });
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const pending = this.pendingLogins.get(state);
    this.pendingLogins.delete(state);
    if (!pending || Date.now() - pending.createdAt > PENDING_LOGIN_TTL_MS) {
      throw new BadRequestException('state inválido o expirado, inicia el login de nuevo');
    }

    const { clientId, redirectUri } = this.requireConfig();
    const token = await this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: pending.verifier,
    });

    const profile = await this.fetchProfile(token.access_token);
    await this.saveToken(token, token.refresh_token ?? '', profile);
    this.logger.log(`Cuenta de Spotify autorizada (${profile.product ?? 'plan desconocido'})`);
  }

  getAuth(): Promise<SpotifyAuth | null> {
    return this.prisma.spotifyAuth.findUnique({ where: { id: AUTH_ROW_ID } });
  }

  async disconnect(): Promise<void> {
    await this.prisma.spotifyAuth.deleteMany({ where: { id: AUTH_ROW_ID } });
  }

  /** Access token vigente (se refresca si está por vencer); null si no hay sesión. */
  async getAccessToken(): Promise<string | null> {
    const row = await this.getAuth();
    if (!row) {
      return null;
    }
    if (row.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return row.accessToken;
    }
    this.refreshing ??= this.refresh(row).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  /** Fuerza un refresh (p. ej. tras un 401 inesperado). */
  async forceRefresh(): Promise<string | null> {
    const row = await this.getAuth();
    return row ? this.refresh(row) : null;
  }

  private async refresh(row: SpotifyAuth): Promise<string> {
    const { clientId } = this.requireConfig();
    const token = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: row.refreshToken,
      client_id: clientId,
    });
    await this.saveToken(token, token.refresh_token ?? row.refreshToken, {
      displayName: row.displayName,
      product: row.product,
    });
    return token.access_token;
  }

  private async fetchProfile(accessToken: string): Promise<{ displayName: string | null; product: string | null }> {
    try {
      const response = await fetch(ME_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.ok) {
        const me = (await response.json()) as { display_name?: string | null; id?: string; product?: string };
        return { displayName: me.display_name || me.id || null, product: me.product ?? null };
      }
    } catch {
      // el perfil es informativo; el login sigue siendo válido sin él
    }
    return { displayName: null, product: null };
  }

  private async requestToken(body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Spotify rechazó la solicitud de token (${response.status}): ${detail.slice(0, 200)}`,
      );
    }
    return (await response.json()) as TokenResponse;
  }

  private async saveToken(
    token: TokenResponse,
    refreshToken: string,
    profile: { displayName: string | null; product: string | null },
  ): Promise<void> {
    const data = {
      accessToken: token.access_token,
      refreshToken,
      scope: token.scope,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      displayName: profile.displayName,
      product: profile.product,
    };
    await this.prisma.spotifyAuth.upsert({
      where: { id: AUTH_ROW_ID },
      create: { id: AUTH_ROW_ID, ...data },
      update: data,
    });
  }

  private requireConfig(): { clientId: string; redirectUri: string } {
    const { clientId, redirectUri } = this.configService.get('spotify', { infer: true });
    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException('Faltan SPOTIFY_CLIENT_ID o SPOTIFY_REDIRECT_URI en el .env');
    }
    return { clientId, redirectUri };
  }
}
