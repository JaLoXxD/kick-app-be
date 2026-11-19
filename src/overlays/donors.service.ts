import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DonorBoard } from '@prisma/client';
import { KickApiService } from '../kick/kick-api.service';
import { KickInternalEvent, KickKicksEvent } from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDonorBoardDto } from './dto/update-donor-board.dto';
import { ANONYMOUS_DONOR, DonorPeriod, OverlaysInternalEvent, WIDGET_ID } from './overlays.constants';
import { SessionService } from './session.service';

export interface DonorEntry {
  username: string;
  total: number;
}

export interface DonorBoardPayload {
  config: DonorBoard;
  entries: DonorEntry[];
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * Top de donadores de KICKs. Para «desde siempre», mes y semana usa el ranking de Kick (necesita el permiso
 * kicks:read); si no está disponible, o para «esta sesión», se calcula con las propinas que el bot vio llegar.
 */
@Injectable()
export class DonorsService {
  private readonly logger = new Logger(DonorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionService: SessionService,
    private readonly kickApi: KickApiService,
  ) {}

  getConfig(): Promise<DonorBoard> {
    return this.prisma.donorBoard.upsert({
      where: { id: WIDGET_ID },
      create: { id: WIDGET_ID },
      update: {},
    });
  }

  async getBoard(): Promise<DonorBoardPayload> {
    const config = await this.getConfig();
    return { config, entries: await this.topEntries(config) };
  }

  async update(dto: UpdateDonorBoardDto): Promise<DonorBoardPayload> {
    await this.getConfig();
    await this.prisma.donorBoard.update({ where: { id: WIDGET_ID }, data: dto });
    return this.emit();
  }

  /** Borra todo el historial de propinas (el top queda vacío). */
  async reset(): Promise<DonorBoardPayload> {
    await this.prisma.kickDonation.deleteMany();
    return this.emit();
  }

  @OnEvent(KickInternalEvent.KICKS)
  async handleKicks(event: KickKicksEvent): Promise<void> {
    if (event.username === ANONYMOUS_DONOR) {
      return;
    }
    try {
      await this.prisma.kickDonation.create({ data: { username: event.username, amount: event.amount } });
      this.kickApi.invalidateLeaderboard();
      await this.emit();
      // Kick tarda unos segundos en reflejar la propina en su ranking.
      setTimeout(() => {
        this.kickApi.invalidateLeaderboard();
        void this.emit().catch(() => undefined);
      }, 20_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`No se pudo registrar la propina de @${event.username}: ${message}`);
    }
  }

  /** Con el periodo "sesión", reiniciar la sesión vacía el top. */
  @OnEvent(OverlaysInternalEvent.SESSION)
  async handleSessionChange(): Promise<void> {
    if ((await this.getConfig()).period === 'session') {
      await this.emit();
    }
  }

  private async emit(): Promise<DonorBoardPayload> {
    const board = await this.getBoard();
    this.eventEmitter.emit(OverlaysInternalEvent.DONORS, board);
    return board;
  }

  private async topEntries(config: DonorBoard): Promise<DonorEntry[]> {
    if (config.period !== 'session') {
      const board = await this.kickApi.getKicksLeaderboard();
      if (board) {
        const rows = { all: board.lifetime, month: board.month, week: board.week }[config.period as 'all' | 'month' | 'week'];
        return rows.slice(0, config.limit).map((row) => ({ username: row.username, total: row.total }));
      }
    }
    const since = await this.periodStart(config.period as DonorPeriod);
    const rows = await this.prisma.kickDonation.groupBy({
      by: ['username'],
      where: since ? { createdAt: { gte: since } } : undefined,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: config.limit,
    });
    return rows.map((row) => ({ username: row.username, total: row._sum.amount ?? 0 }));
  }

  private async periodStart(period: DonorPeriod): Promise<Date | null> {
    switch (period) {
      case 'week':
        return new Date(Date.now() - 7 * DAY_MS);
      case 'month':
        return new Date(Date.now() - 30 * DAY_MS);
      case 'session':
        return (await this.sessionService.getConfig()).startedAt;
      default:
        return null;
    }
  }
}
