import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SessionCounter } from '@prisma/client';
import { KickApiService } from '../kick/kick-api.service';
import {
  KickFollowEvent,
  KickGiftSubscriptionEvent,
  KickInternalEvent,
  KickKicksEvent,
} from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSessionDto } from './dto/update-session.dto';
import { OverlaysInternalEvent, WIDGET_ID } from './overlays.constants';

/** Fila del contador más el total de suscriptores activos del canal (de la API de Kick; null si no se pudo leer). */
export type SessionPayload = SessionCounter & { totalSubscribers: number | null };

const STATS_REFRESH_MS = 2 * 60_000;

/** Contador de lo ganado en la sesión: seguidores, subs (nuevas y regaladas) y KICKs. */
@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  /** Quien sigue, deja de seguir y vuelve a seguir en la misma sesión cuenta una sola vez. */
  private readonly followersThisSession = new Set<string>();
  private lastTotal: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly kickApi: KickApiService,
  ) {}

  /** Cada pocos minutos se relee el total de suscriptores y, si cambió, se avisa a los overlays. */
  onModuleInit(): void {
    this.timer = setInterval(() => void this.refreshTotal(), STATS_REFRESH_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async getConfig(): Promise<SessionPayload> {
    return this.withTotal(await this.row());
  }

  private row(): Promise<SessionCounter> {
    return this.prisma.sessionCounter.upsert({
      where: { id: WIDGET_ID },
      create: { id: WIDGET_ID },
      update: {},
    });
  }

  private async withTotal(row: SessionCounter): Promise<SessionPayload> {
    const stats = await this.kickApi.getSubscriberStats();
    this.lastTotal = stats?.active ?? null;
    return { ...row, totalSubscribers: this.lastTotal };
  }

  private async refreshTotal(): Promise<void> {
    try {
      const before = this.lastTotal;
      const payload = await this.getConfig();
      if (payload.totalSubscribers !== before) {
        this.eventEmitter.emit(OverlaysInternalEvent.SESSION, payload);
      }
    } catch (error) {
      this.logger.warn(`No se pudo actualizar el total de suscriptores: ${error instanceof Error ? error.message : error}`);
    }
  }

  async update(dto: UpdateSessionDto): Promise<SessionPayload> {
    await this.row();
    return this.emit(await this.prisma.sessionCounter.update({ where: { id: WIDGET_ID }, data: dto }));
  }

  /** Pone los contadores en cero y marca el inicio de una sesión nueva. */
  async reset(): Promise<SessionPayload> {
    await this.row();
    this.followersThisSession.clear();
    return this.emit(
      await this.prisma.sessionCounter.update({
        where: { id: WIDGET_ID },
        data: { followers: 0, subs: 0, giftedSubs: 0, kicks: 0, startedAt: new Date() },
      }),
    );
  }

  @OnEvent(KickInternalEvent.FOLLOW)
  handleFollow(event: KickFollowEvent): Promise<void> {
    const key = event.username.toLowerCase();
    if (this.followersThisSession.has(key)) {
      return Promise.resolve();
    }
    this.followersThisSession.add(key);
    return this.increment({ followers: 1 }, 'seguidor');
  }

  @OnEvent(KickInternalEvent.SUBSCRIPTION)
  handleSubscription(): Promise<void> {
    return this.increment({ subs: 1 }, 'suscripción');
  }

  @OnEvent(KickInternalEvent.GIFT_SUBSCRIPTION)
  handleGift(event: KickGiftSubscriptionEvent): Promise<void> {
    return this.increment({ giftedSubs: event.amount }, 'subs regaladas');
  }

  @OnEvent(KickInternalEvent.KICKS)
  handleKicks(event: KickKicksEvent): Promise<void> {
    return this.increment({ kicks: event.amount }, 'KICKs');
  }

  private async increment(
    data: Partial<Record<'followers' | 'subs' | 'giftedSubs' | 'kicks', number>>,
    what: string,
  ): Promise<void> {
    try {
      await this.row();
      const increments = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { increment: value }]));
      await this.emit(await this.prisma.sessionCounter.update({ where: { id: WIDGET_ID }, data: increments }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo sumar (${what}) al contador de la sesión: ${message}`);
    }
  }

  private async emit(row: SessionCounter): Promise<SessionPayload> {
    const payload = await this.withTotal(row);
    this.eventEmitter.emit(OverlaysInternalEvent.SESSION, payload);
    return payload;
  }
}
