import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createPublicKey, createVerify } from 'node:crypto';
import {
  KickChatEvent,
  KickChatWebhookPayload,
  KickFollowEvent,
  KickFollowWebhookPayload,
  KickInternalEvent,
  KickGiftSubscriptionEvent,
  KickGiftSubscriptionWebhookPayload,
  KickKicksEvent,
  KickKicksWebhookPayload,
  KickSubscriptionEvent,
  KickSubscriptionNewWebhookPayload,
} from './kick.events';

const ANONYMOUS_NAME = 'Anónimo';

const PUBLIC_KEY_URL = 'https://api.kick.com/public/v1/public-key';
const DEDUPE_TTL_MS = 10 * 60_000;

export interface KickWebhookHeaders {
  messageId: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  eventType: string | undefined;
}

@Injectable()
export class KickWebhookService {
  private readonly logger = new Logger(KickWebhookService.name);
  private publicKeyPem: string | null = null;
  /** Kick entrega "al menos una vez": se ignoran los message ids ya procesados. */
  private readonly seenMessages = new Map<string, number>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async handle(headers: KickWebhookHeaders, rawBody: Buffer): Promise<void> {
    const { messageId, timestamp, signature, eventType } = headers;
    if (!messageId || !timestamp || !signature) {
      throw new UnauthorizedException('Faltan cabeceras de firma de Kick');
    }
    if (!(await this.isSignatureValid(`${messageId}.${timestamp}.${rawBody.toString('utf8')}`, signature))) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
    if (this.isDuplicate(messageId)) {
      return;
    }

    if (eventType === 'chat.message.sent') {
      const payload = JSON.parse(rawBody.toString('utf8')) as KickChatWebhookPayload;
      this.eventEmitter.emit(KickInternalEvent.CHAT, {
        messageId: payload.message_id,
        username: payload.sender.username,
        text: payload.content,
        badges: (payload.sender.identity?.badges ?? [])
          .map((badge) => badge.type?.toLowerCase())
          .filter((type): type is string => Boolean(type)),
      } satisfies KickChatEvent);
    } else if (eventType === 'channel.followed') {
      const payload = JSON.parse(rawBody.toString('utf8')) as KickFollowWebhookPayload;
      if (payload.follower?.username) {
        this.eventEmitter.emit(KickInternalEvent.FOLLOW, {
          username: payload.follower.username,
        } satisfies KickFollowEvent);
      }
    } else if (eventType === 'kicks.gifted') {
      const payload = JSON.parse(rawBody.toString('utf8')) as KickKicksWebhookPayload;
      const amount = Number(payload.gift?.amount);
      if (Number.isFinite(amount) && amount > 0) {
        this.eventEmitter.emit(KickInternalEvent.KICKS, {
          username: payload.sender?.username || ANONYMOUS_NAME,
          amount,
        } satisfies KickKicksEvent);
      }
    } else if (eventType === 'channel.subscription.new') {
      const payload = JSON.parse(rawBody.toString('utf8')) as KickSubscriptionNewWebhookPayload;
      this.eventEmitter.emit(KickInternalEvent.SUBSCRIPTION, {
        username: payload.subscriber?.username || ANONYMOUS_NAME,
      } satisfies KickSubscriptionEvent);
    } else if (eventType === 'channel.subscription.gifts') {
      const payload = JSON.parse(rawBody.toString('utf8')) as KickGiftSubscriptionWebhookPayload;
      const amount = Array.isArray(payload.giftees) ? payload.giftees.length : 0;
      if (amount > 0) {
        this.eventEmitter.emit(KickInternalEvent.GIFT_SUBSCRIPTION, {
          username: payload.gifter?.username || ANONYMOUS_NAME,
          amount,
        } satisfies KickGiftSubscriptionEvent);
      }
    }
  }

  /** La clave pública se cachea; si la verificación falla se vuelve a pedir una vez (rotación). */
  private async isSignatureValid(message: string, signatureBase64: string): Promise<boolean> {
    if (this.verify(await this.getPublicKey(false), message, signatureBase64)) {
      return true;
    }
    return this.verify(await this.getPublicKey(true), message, signatureBase64);
  }

  private verify(publicKeyPem: string, message: string, signatureBase64: string): boolean {
    try {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(message);
      return verifier.verify(createPublicKey(publicKeyPem), Buffer.from(signatureBase64, 'base64'));
    } catch {
      return false;
    }
  }

  private async getPublicKey(forceRefresh: boolean): Promise<string> {
    if (this.publicKeyPem && !forceRefresh) {
      return this.publicKeyPem;
    }
    const response = await fetch(PUBLIC_KEY_URL);
    if (!response.ok) {
      throw new Error(`No se pudo obtener la clave pública de Kick (${response.status})`);
    }
    const text = await response.text();
    const pem = text.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/)?.[0];
    // La respuesta puede ser JSON con el PEM escapado (\n literales).
    const normalized = pem ?? (JSON.parse(text) as { data?: { public_key?: string } }).data?.public_key;
    if (!normalized) {
      throw new Error('Formato inesperado en la clave pública de Kick');
    }
    this.publicKeyPem = normalized.replace(/\\n/g, '\n');
    this.logger.log('Clave pública de Kick actualizada');
    return this.publicKeyPem;
  }

  private isDuplicate(messageId: string): boolean {
    const now = Date.now();
    for (const [id, seenAt] of this.seenMessages) {
      if (now - seenAt > DEDUPE_TTL_MS) {
        this.seenMessages.delete(id);
      }
    }
    if (this.seenMessages.has(messageId)) {
      return true;
    }
    this.seenMessages.set(messageId, now);
    return false;
  }
}
