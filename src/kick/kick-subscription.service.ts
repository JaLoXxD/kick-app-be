import { Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KickAuthService } from './kick-auth.service';
import { KickInternalEvent, KickStatusEvent } from './kick.events';

const SUBSCRIPTIONS_URL = 'https://api.kick.com/public/v1/events/subscriptions';
/** Eventos de Kick que el bot necesita: chat (voz) y los de las alertas (seguidores, KICKs, suscripciones nuevas y regaladas). */
const WANTED_EVENTS = [
  'chat.message.sent',
  'channel.followed',
  'kicks.gifted',
  'channel.subscription.new',
  'channel.subscription.gifts',
];

@Injectable()
export class KickSubscriptionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(KickSubscriptionService.name);
  private subscribed = false;
  /** Consultar a Kick en cada /kick/status es innecesario: se cachea unos segundos. */
  private statusCache: { value: boolean; expiresAt: number } | null = null;

  constructor(
    private readonly authService: KickAuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Al arrancar, si ya hay sesión de Kick, se asegura que estén todas las suscripciones (p. ej. follows tras una actualización). */
  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.authService.isAuthenticated())) {
      return;
    }
    try {
      await this.ensureSubscriptions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudieron asegurar las suscripciones al arrancar: ${message}`);
    }
  }

  /**
   * Suscribe el canal del usuario autorizado a los eventos que usa el bot (entrega por webhook).
   * Solo pide los que faltan, para no duplicar suscripciones que ya existen en Kick.
   */
  async ensureSubscriptions(): Promise<void> {
    const accessToken = await this.authService.getAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };

    const current = await fetch(SUBSCRIPTIONS_URL, { headers });
    const existing = current.ok
      ? (((await current.json()) as { data?: { event: string }[] }).data ?? []).map((item) => item.event)
      : [];
    const missing = WANTED_EVENTS.filter((name) => !existing.includes(name));

    // Uno por uno: si Kick rechaza un evento (p. ej. por permisos) los demás igual quedan suscritos.
    const failed: string[] = [];
    for (const name of missing) {
      const response = await fetch(SUBSCRIPTIONS_URL, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'webhook', events: [{ name, version: 1 }] }),
      });
      const detail = await response.text().catch(() => '');
      const rejected = !response.ok || /"error"\s*:\s*"[^"]/.test(detail);
      if (rejected) {
        failed.push(name);
        this.logger.warn(`Kick rechazó la suscripción a ${name} (${response.status}): ${detail.slice(0, 200)}`);
      } else {
        this.logger.log(`Suscrito a ${name}`);
      }
    }
    if (failed.length > 0) {
      throw new ServiceUnavailableException(`No se pudo suscribir a: ${failed.join(', ')}`);
    }

    this.subscribed = true;
    this.statusCache = null;
    await this.emitStatus();
  }

  async getStatus(): Promise<KickStatusEvent> {
    const authenticated = await this.authService.isAuthenticated();
    return { authenticated, subscribed: authenticated && (await this.isSubscribedInKick()) };
  }

  /** La suscripción vive en Kick (sobrevive a reinicios del backend), así que se le pregunta a él. */
  private async isSubscribedInKick(): Promise<boolean> {
    if (this.statusCache && this.statusCache.expiresAt > Date.now()) {
      return this.statusCache.value;
    }
    try {
      const response = await fetch(SUBSCRIPTIONS_URL, {
        headers: { Authorization: `Bearer ${await this.authService.getAccessToken()}` },
      });
      if (!response.ok) {
        return this.subscribed;
      }
      const body = (await response.json()) as { data?: { event: string }[] };
      this.subscribed = (body.data ?? []).some((item) => item.event === 'chat.message.sent');
      this.statusCache = { value: this.subscribed, expiresAt: Date.now() + 30_000 };
      return this.subscribed;
    } catch {
      return this.subscribed;
    }
  }

  private async emitStatus(): Promise<void> {
    this.eventEmitter.emit(KickInternalEvent.STATUS, await this.getStatus());
  }
}
