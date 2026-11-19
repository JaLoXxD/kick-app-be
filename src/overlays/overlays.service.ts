import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { LastEventOverlay } from '@prisma/client';
import { KickFollowEvent, KickInternalEvent, KickSubscriptionEvent } from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLastEventDto } from './dto/update-last-event.dto';
import { LAST_EVENT_DEFAULTS, LastEventType, OverlaysInternalEvent } from './overlays.constants';

@Injectable()
export class OverlaysService {
  private readonly logger = new Logger(OverlaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getConfig(type: LastEventType): Promise<LastEventOverlay> {
    return this.prisma.lastEventOverlay.upsert({
      where: { type },
      create: { type, textTemplate: LAST_EVENT_DEFAULTS[type].textTemplate },
      update: {},
    });
  }

  async update(type: LastEventType, dto: UpdateLastEventDto): Promise<LastEventOverlay> {
    await this.getConfig(type);
    const config = await this.prisma.lastEventOverlay.update({ where: { type }, data: dto });
    this.eventEmitter.emit(OverlaysInternalEvent.UPDATE, config);
    return config;
  }

  /** Cada suscripción nueva reemplaza a la anterior en el overlay. */
  @OnEvent(KickInternalEvent.SUBSCRIPTION)
  async handleSubscription(event: KickSubscriptionEvent): Promise<void> {
    try {
      const config = await this.update('subscriber', { lastUsername: event.username });
      this.logger.log(`Último suscriptor: @${config.lastUsername}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo guardar el último suscriptor @${event.username}: ${message}`);
    }
  }

  /** Cada seguidor nuevo reemplaza al anterior en el overlay. */
  @OnEvent(KickInternalEvent.FOLLOW)
  async handleFollow(event: KickFollowEvent): Promise<void> {
    try {
      const config = await this.update('follower', { lastUsername: event.username });
      this.logger.log(`Último seguidor: @${config.lastUsername}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo guardar el último seguidor @${event.username}: ${message}`);
    }
  }
}
