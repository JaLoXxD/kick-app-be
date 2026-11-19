import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GoalConfig } from '@prisma/client';
import {
  KickFollowEvent,
  KickGiftSubscriptionEvent,
  KickInternalEvent,
  KickKicksEvent,
  KickSubscriptionEvent,
} from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGoalConfigDto } from './dto/update-goal-config.dto';
import { GOAL_DEFAULTS, GOAL_IDS, GoalId, GoalsInternalEvent } from './goals.constants';

/** Un mismo usuario no suma dos veces en este lapso (seguir/dejar de seguir/seguir no infla la meta). */
const REPEAT_FOLLOW_WINDOW_MS = 24 * 60 * 60_000;

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);
  private readonly recentFollowers = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getConfig(id: GoalId = 'follow'): Promise<GoalConfig> {
    return this.prisma.goalConfig.upsert({
      where: { id },
      create: { id, ...GOAL_DEFAULTS[id] },
      update: {},
    });
  }

  /** Las tres metas, para quien se acaba de conectar. */
  getAll(): Promise<GoalConfig[]> {
    return Promise.all(GOAL_IDS.map((id) => this.getConfig(id)));
  }

  async update(id: GoalId, dto: UpdateGoalConfigDto): Promise<GoalConfig> {
    await this.getConfig(id);
    const config = await this.prisma.goalConfig.update({ where: { id }, data: dto });
    this.eventEmitter.emit(GoalsInternalEvent.UPDATE, config);
    return config;
  }

  /** Cada seguidor nuevo suma uno al contador; Kick no informa los "dejar de seguir", se corrige a mano. */
  @OnEvent(KickInternalEvent.FOLLOW)
  async handleFollow(event: KickFollowEvent): Promise<void> {
    if (this.isRepeat(event.username)) {
      this.logger.log(`Seguidor @${event.username} repetido (<24 h): no suma a la meta`);
      return;
    }
    await this.increment('follow', 1, event.username);
  }

  @OnEvent(KickInternalEvent.KICKS)
  async handleKicks(event: KickKicksEvent): Promise<void> {
    await this.increment('kicks', event.amount, event.username);
  }

  @OnEvent(KickInternalEvent.SUBSCRIPTION)
  async handleSubscription(event: KickSubscriptionEvent): Promise<void> {
    await this.increment('subs', 1, event.username);
  }

  /** Las subs regaladas cuentan una por cada regalo. */
  @OnEvent(KickInternalEvent.GIFT_SUBSCRIPTION)
  async handleGiftSubscription(event: KickGiftSubscriptionEvent): Promise<void> {
    await this.increment('subs', Math.max(1, event.amount), event.username);
  }

  private async increment(id: GoalId, amount: number, username: string): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    try {
      await this.getConfig(id);
      const config = await this.prisma.goalConfig.update({
        where: { id },
        data: { currentCount: { increment: Math.floor(amount) } },
      });
      this.logger.log(`Meta "${id}": ${config.currentCount}/${config.goalCount}`);
      this.eventEmitter.emit(GoalsInternalEvent.UPDATE, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo sumar a la meta "${id}" lo de @${username}: ${message}`);
    }
  }

  private isRepeat(username: string): boolean {
    const now = Date.now();
    for (const [name, at] of this.recentFollowers) {
      if (now - at > REPEAT_FOLLOW_WINDOW_MS) {
        this.recentFollowers.delete(name);
      }
    }
    const key = username.toLowerCase();
    if (this.recentFollowers.has(key)) {
      return true;
    }
    this.recentFollowers.set(key, now);
    return false;
  }
}
