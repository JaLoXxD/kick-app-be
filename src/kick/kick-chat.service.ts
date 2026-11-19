import { Injectable, Logger } from '@nestjs/common';
import { KickAuthService } from './kick-auth.service';

const CHAT_URL = 'https://api.kick.com/public/v1/chat';
const USERS_URL = 'https://api.kick.com/public/v1/users';
const MAX_LENGTH = 500;

/** Escribe en el chat del canal. Necesita el permiso chat:write (ver KICK_EXTRA_SCOPES). */
@Injectable()
export class KickChatService {
  private readonly logger = new Logger(KickChatService.name);
  private warnedStatus: number | null = null;
  /** Si Kick no tiene "bot" para esta app (404), se escribe como el usuario autorizado. */
  private asUser = false;
  private broadcasterId: number | null = null;

  constructor(private readonly authService: KickAuthService) {}

  /** Mejor esfuerzo: nunca lanza; si falla (p. ej. sin permiso) lo registra una sola vez por código. */
  async send(content: string): Promise<void> {
    try {
      const token = await this.authService.getAccessToken();
      const text = content.slice(0, MAX_LENGTH);

      let response = this.asUser ? null : await this.post(token, { content: text, type: 'bot' });
      if (!response || response.status === 404) {
        const id = await this.getBroadcasterId(token);
        if (id !== null) {
          this.asUser = true;
          response = await this.post(token, { content: text, type: 'user', broadcaster_user_id: id });
        }
      }
      if (response && !response.ok && this.warnedStatus !== response.status) {
        this.warnedStatus = response.status;
        const detail = await response.text().catch(() => '');
        this.logger.warn(
          `Kick no dejó escribir en el chat (${response.status}). ¿Falta el permiso chat:write? ${detail.slice(0, 150)}`,
        );
      }
    } catch (error) {
      this.logger.warn(`No se pudo escribir en el chat: ${error instanceof Error ? error.message : error}`);
    }
  }

  private post(token: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Id del usuario autorizado (el dueño del canal). */
  private async getBroadcasterId(token: string): Promise<number | null> {
    if (this.broadcasterId !== null) {
      return this.broadcasterId;
    }
    const response = await fetch(USERS_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data?: { user_id?: number }[] };
    this.broadcasterId = body.data?.[0]?.user_id ?? null;
    return this.broadcasterId;
  }
}
