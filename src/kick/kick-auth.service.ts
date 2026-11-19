import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_URL = 'https://id.kick.com/oauth/authorize';
const TOKEN_URL = 'https://id.kick.com/oauth/token';
const BASE_SCOPES = 'user:read channel:read events:subscribe';
const AUTH_ROW_ID = 'streamer';
/** Se refresca el token si le quedan menos de 60 s de vida. */
const REFRESH_MARGIN_MS = 60_000;
const PENDING_LOGIN_TTL_MS = 10 * 60_000;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

@Injectable()
export class KickAuthService {
  private readonly logger = new Logger(KickAuthService.name);
  /** state -> code_verifier, mientras el usuario completa el login en Kick. */
  private readonly pendingLogins = new Map<string, { verifier: string; createdAt: number }>();

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  buildLoginUrl(): string {
    const { clientId, redirectUri } = this.requireKickConfig();
    this.purgeExpiredLogins();

    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(16).toString('hex');
    this.pendingLogins.set(state, { verifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: this.scopes(),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  private scopes(): string {
    const { extraScopes } = this.configService.get('kick', { infer: true });
    return [BASE_SCOPES, ...extraScopes.split(/[\s,]+/).filter(Boolean)].join(' ');
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const pending = this.pendingLogins.get(state);
    this.pendingLogins.delete(state);
    if (!pending || Date.now() - pending.createdAt > PENDING_LOGIN_TTL_MS) {
      throw new BadRequestException('state inválido o expirado, inicia el login de nuevo');
    }

    const { clientId, clientSecret, redirectUri } = this.requireKickConfig();
    const token = await this.requestToken({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: pending.verifier,
    });
    await this.saveToken(token);
    this.logger.log('Cuenta de Kick autorizada');
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.prisma.kickAuth.findUnique({ where: { id: AUTH_ROW_ID } })) !== null;
  }

  /** Devuelve un access token vigente, refrescándolo si está por vencer. */
  async getAccessToken(): Promise<string> {
    const row = await this.prisma.kickAuth.findUnique({ where: { id: AUTH_ROW_ID } });
    if (!row) {
      throw new ServiceUnavailableException('Kick no está autorizado: visita /kick/auth/login');
    }
    if (row.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return row.accessToken;
    }

    const { clientId, clientSecret } = this.requireKickConfig();
    const token = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: row.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    await this.saveToken(token);
    return token.access_token;
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
        `Kick rechazó la solicitud de token (${response.status}): ${detail.slice(0, 200)}`,
      );
    }
    return (await response.json()) as TokenResponse;
  }

  private async saveToken(token: TokenResponse): Promise<void> {
    const data = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scope: token.scope,
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
    };
    await this.prisma.kickAuth.upsert({
      where: { id: AUTH_ROW_ID },
      create: { id: AUTH_ROW_ID, ...data },
      update: data,
    });
  }

  private purgeExpiredLogins(): void {
    const now = Date.now();
    for (const [state, { createdAt }] of this.pendingLogins) {
      if (now - createdAt > PENDING_LOGIN_TTL_MS) {
        this.pendingLogins.delete(state);
      }
    }
  }

  private requireKickConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
    const { clientId, clientSecret, redirectUri } = this.configService.get('kick', { infer: true });
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        'Faltan KICK_CLIENT_ID, KICK_CLIENT_SECRET o KICK_REDIRECT_URI en el .env',
      );
    }
    return { clientId, clientSecret, redirectUri };
  }
}
