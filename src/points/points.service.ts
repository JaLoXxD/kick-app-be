import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PointsBalance, PointsConfig, PointsLog, Prisma } from '@prisma/client';
import { KickChatService } from '../kick/kick-chat.service';
import {
  KickChatEvent,
  KickFollowEvent,
  KickGiftSubscriptionEvent,
  KickInternalEvent,
  KickKicksEvent,
  KickSubscriptionEvent,
} from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePointsConfigDto } from './dto/points.dto';
import { PointsInternalEvent, SpinEvent } from './points.constants';

const CONFIG_ID = 'app';
const EMOTE_PATTERN = /\[emote:\d+:[^\]]*\]/g;
const MAX_BALANCE = 2_000_000_000;

export interface Outcome {
  label: string;
  multiplier: number;
  weight: number;
}

export interface UserPoints {
  username: string;
  displayName: string;
  balance: number;
  earned: number;
  updatedAt: Date;
}

export interface RouletteResult {
  ok: boolean;
  message: string;
}

const key = (username: string): string => username.trim().toLowerCase();

@Injectable()
export class PointsService implements OnModuleInit {
  private readonly logger = new Logger(PointsService.name);
  private config: PointsConfig | null = null;
  private readonly lastEarn = new Map<string, number>();
  private readonly lastSpin = new Map<string, number>();
  /** Usuarios con una apuesta en curso, para que no se solapen dos tiradas del mismo usuario. */
  private readonly spinning = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kickChat: KickChatService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getConfig();
  }

  // ---------------------------------------------------------------- ajustes

  async getConfig(): Promise<PointsConfig> {
    this.config ??= await this.prisma.pointsConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID },
      update: {},
    });
    return this.config;
  }

  async updateConfig(dto: UpdatePointsConfigDto): Promise<PointsConfig> {
    const current = await this.getConfig();
    // El DTO transformado puede traer claves con `undefined`; no deben pisar los valores actuales.
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Record<string, unknown>;
    for (const field of ['pointsCommand', 'rouletteCommand', 'duelCommand', 'acceptCommand', 'declineCommand']) {
      if (typeof data[field] === 'string') {
        data[field] = (data[field] as string).toLowerCase();
      }
    }
    if (Array.isArray(data['outcomes'])) {
      data['outcomes'] = (data['outcomes'] as Outcome[]).map(({ label, multiplier, weight }) => ({
        label: label.trim() || `x${multiplier}`,
        multiplier,
        weight,
      }));
    }
    const next = { ...current, ...data } as PointsConfig;
    const reserved = this.reservedCommands(next);
    if (new Set(reserved).size !== reserved.length) {
      throw new Error('Los comandos de puntos, ruleta y duelos deben ser todos distintos');
    }
    if (next.duelMinBet > next.duelMaxBet) {
      throw new Error('La apuesta mínima del duelo no puede ser mayor que la máxima');
    }
    if (next.minBet > next.maxBet) {
      throw new Error('La apuesta mínima no puede ser mayor que la máxima');
    }
    if (!this.parseOutcomes(next.outcomes).some((outcome) => outcome.weight > 0)) {
      throw new Error('La ruleta necesita al menos un resultado con probabilidad');
    }
    this.config = await this.prisma.pointsConfig.update({
      where: { id: CONFIG_ID },
      data: data as Prisma.PointsConfigUpdateInput,
    });
    return this.config;
  }

  private parseOutcomes(raw: unknown): Outcome[] {
    return Array.isArray(raw) ? (raw as Outcome[]) : [];
  }

  /** Probabilidad y retorno esperado por cada punto apostado (1 = ni gana ni pierde a la larga). */
  expectedReturn(config: PointsConfig): number {
    const outcomes = this.parseOutcomes(config.outcomes);
    const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    return total > 0 ? outcomes.reduce((sum, o) => sum + o.multiplier * o.weight, 0) / total : 0;
  }

  // ---------------------------------------------------------------- saldos

  /** Ajustes ya cargados (null hasta que arranca el módulo). */
  snapshot(): PointsConfig | null {
    return this.config;
  }

  private readonly matchers: ((text: string) => boolean)[] = [];

  /** Otros servicios del módulo (comandos, duelos) registran aquí qué mensajes son comandos suyos. */
  registerMatcher(matcher: (text: string) => boolean): void {
    this.matchers.push(matcher);
  }

  /** ¿Es un comando de puntos? Para que el TTS no lo lea en voz alta. */
  isCommand(text: string): boolean {
    const config = this.config;
    if (!config?.enabled) {
      return false;
    }
    const lower = text.trim().toLowerCase();
    return (
      [config.pointsCommand, config.rouletteCommand].some(
        (command) => lower === command || lower.startsWith(`${command} `),
      ) || this.matchers.some((matcher) => matcher(lower))
    );
  }

  /** Comandos que no pueden usar los comandos personalizados porque ya tienen otro significado. */
  reservedCommands(config: PointsConfig): string[] {
    return [
      config.pointsCommand,
      config.rouletteCommand,
      config.duelCommand,
      config.acceptCommand,
      config.declineCommand,
    ];
  }

  /** Cobra `amount` de forma atómica; false si el saldo no alcanza. */
  async charge(username: string, amount: number, reason: string, note?: string): Promise<boolean> {
    if (amount <= 0) {
      return true;
    }
    const id = key(username);
    const result = await this.prisma.pointsBalance.updateMany({
      where: { username: id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (result.count === 0) {
      return false;
    }
    await this.prisma.pointsLog.create({ data: { username: id, delta: -amount, reason, note: note ?? null } });
    return true;
  }

  /** Devuelve o paga puntos (no cuentan como "ganados por actividad"). */
  async credit(username: string, amount: number, reason: string, note?: string): Promise<void> {
    if (amount <= 0) {
      return;
    }
    const id = key(username);
    await this.prisma.pointsBalance.upsert({
      where: { username: id },
      create: { username: id, displayName: username, balance: amount },
      update: { balance: { increment: amount } },
    });
    await this.prisma.pointsLog.create({ data: { username: id, delta: amount, reason, note: note ?? null } });
  }

  /** Escribe en el chat de Kick si las respuestas están activadas. */
  async say(message: string): Promise<void> {
    const config = await this.getConfig();
    this.logger.log(message);
    if (config.replyInChat) {
      await this.kickChat.send(message);
    }
  }

  async getBalance(username: string): Promise<number> {
    const row = await this.prisma.pointsBalance.findUnique({ where: { username: key(username) } });
    return row?.balance ?? 0;
  }

  /** Suma puntos ganados por actividad (crea al usuario si hace falta). */
  private async earn(username: string, amount: number, reason: string | null): Promise<void> {
    if (amount <= 0) {
      return;
    }
    const id = key(username);
    await this.prisma.pointsBalance.upsert({
      where: { username: id },
      create: { username: id, displayName: username, balance: amount, earned: amount },
      update: { displayName: username, balance: { increment: amount }, earned: { increment: amount } },
    });
    if (reason) {
      await this.prisma.pointsLog.create({ data: { username: id, delta: amount, reason } });
    }
  }

  /** Ajuste manual: suma o resta sin dejar el saldo por debajo de 0. */
  async adjust(username: string, amount: number, note?: string): Promise<UserPoints> {
    const id = key(username);
    if (!id) {
      throw new Error('Falta el usuario');
    }
    const existing = await this.prisma.pointsBalance.findUnique({ where: { username: id } });
    const current = existing?.balance ?? 0;
    const target = Math.min(MAX_BALANCE, Math.max(0, current + amount));
    const delta = target - current;
    const row = await this.prisma.pointsBalance.upsert({
      where: { username: id },
      create: { username: id, displayName: username.trim(), balance: target },
      update: { balance: target },
    });
    await this.prisma.pointsLog.create({
      data: { username: id, delta, reason: 'admin', note: note?.trim() || null },
    });
    return row;
  }

  async setBalance(username: string, balance: number): Promise<UserPoints> {
    const current = await this.getBalance(username);
    return this.adjust(username, balance - current, 'Saldo fijado a mano');
  }

  async removeUser(username: string): Promise<void> {
    await this.prisma.pointsBalance.deleteMany({ where: { username: key(username) } });
  }

  async listUsers(search: string, take: number, skip: number, sort: 'balance' | 'earned' | 'name') {
    const where: Prisma.PointsBalanceWhereInput = search.trim()
      ? { username: { contains: key(search) } }
      : {};
    const orderBy: Prisma.PointsBalanceOrderByWithRelationInput =
      sort === 'name' ? { username: 'asc' } : sort === 'earned' ? { earned: 'desc' } : { balance: 'desc' };
    const [items, total, sum] = await Promise.all([
      this.prisma.pointsBalance.findMany({ where, orderBy, take, skip }),
      this.prisma.pointsBalance.count({ where }),
      this.prisma.pointsBalance.aggregate({ _sum: { balance: true } }),
    ]);
    return { items, total, totalPoints: sum._sum.balance ?? 0 };
  }

  recentLog(take = 50): Promise<PointsLog[]> {
    return this.prisma.pointsLog.findMany({ orderBy: { createdAt: 'desc' }, take });
  }

  // ---------------------------------------------------------------- ganar puntos

  @OnEvent(KickInternalEvent.FOLLOW)
  async onFollow(event: KickFollowEvent): Promise<void> {
    await this.bonus(event.username, (c) => c.followBonus, 'follow');
  }

  @OnEvent(KickInternalEvent.SUBSCRIPTION)
  async onSubscription(event: KickSubscriptionEvent): Promise<void> {
    await this.bonus(event.username, (c) => c.subBonus, 'sub');
  }

  @OnEvent(KickInternalEvent.GIFT_SUBSCRIPTION)
  async onGift(event: KickGiftSubscriptionEvent): Promise<void> {
    await this.bonus(event.username, (c) => c.giftSubBonus * Math.max(1, event.amount), 'sub regalada');
  }

  @OnEvent(KickInternalEvent.KICKS)
  async onKicks(event: KickKicksEvent): Promise<void> {
    await this.bonus(event.username, (c) => c.perKick * Math.max(0, event.amount), 'KICKs');
  }

  private async bonus(username: string, amount: (config: PointsConfig) => number, reason: string): Promise<void> {
    const config = this.config;
    if (!config?.enabled || !username || username.toLowerCase() === 'anonymous') {
      return;
    }
    try {
      await this.earn(username, amount(config), reason);
    } catch (error) {
      this.logger.error(`No se pudo dar puntos a @${username}: ${error instanceof Error ? error.message : error}`);
    }
  }

  @OnEvent(KickInternalEvent.CHAT)
  async handleChat(event: KickChatEvent): Promise<void> {
    const config = this.config;
    if (!config?.enabled) {
      return;
    }
    const text = event.text.replace(EMOTE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    const lower = text.toLowerCase();
    const isCommand = (command: string): boolean => lower === command || lower.startsWith(`${command} `);

    try {
      if (isCommand(config.pointsCommand)) {
        await this.reply(config, event.username, await this.balanceMessage(config, event.username));
      } else if (isCommand(config.rouletteCommand)) {
        const result = await this.spin(event.username, text.slice(config.rouletteCommand.length));
        await this.reply(config, event.username, result.message);
      } else if (config.perMessage > 0 && text) {
        await this.earnFromMessage(config, event.username);
      }
    } catch (error) {
      this.logger.error(`Error con puntos de @${event.username}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async earnFromMessage(config: PointsConfig, username: string): Promise<void> {
    const id = key(username);
    const now = Date.now();
    if (now - (this.lastEarn.get(id) ?? 0) < config.messageCooldownSeconds * 1000) {
      return;
    }
    this.lastEarn.set(id, now);
    await this.earn(username, config.perMessage, null);
  }

  private async reply(config: PointsConfig, username: string, message: string): Promise<void> {
    this.logger.log(`@${username}: ${message}`);
    if (config.replyInChat) {
      await this.kickChat.send(`@${username} ${message}`);
    }
  }

  private async balanceMessage(config: PointsConfig, username: string): Promise<string> {
    const id = key(username);
    const row = await this.prisma.pointsBalance.findUnique({ where: { username: id } });
    if (!row) {
      return `tienes 0 ${config.pointsName}`;
    }
    const ahead = await this.prisma.pointsBalance.count({ where: { balance: { gt: row.balance } } });
    return `tienes ${row.balance} ${config.pointsName} (puesto #${ahead + 1})`;
  }

  // ---------------------------------------------------------------- ruleta

  /** `!ruleta <apuesta|all>`. También la usa el dashboard para probar (con usuario y sin cooldown). */
  async spin(username: string, rawArgs: string, ignoreCooldown = false): Promise<RouletteResult> {
    const config = await this.getConfig();
    if (!config.rouletteEnabled) {
      return { ok: false, message: 'la ruleta está desactivada' };
    }
    const id = key(username);
    const arg = rawArgs.trim().toLowerCase();
    const balance = await this.getBalance(username);
    const name = config.pointsName;

    let bet: number;
    if (!arg) {
      return {
        ok: false,
        message: `uso: ${config.rouletteCommand} <cantidad|all> (mín. ${config.minBet}, máx. ${config.maxBet}). Tienes ${balance} ${name}`,
      };
    }
    if (arg === 'all' || arg === 'todo') {
      bet = Math.min(balance, config.maxBet);
    } else if (/^\d+$/.test(arg)) {
      bet = Number(arg);
    } else {
      return { ok: false, message: `apuesta inválida. Uso: ${config.rouletteCommand} <cantidad|all>` };
    }

    if (bet < config.minBet) {
      return {
        ok: false,
        message: balance < config.minBet
          ? `necesitas al menos ${config.minBet} ${name} para jugar (tienes ${balance})`
          : `la apuesta mínima es ${config.minBet} ${name}`,
      };
    }
    if (bet > config.maxBet) {
      return { ok: false, message: `la apuesta máxima es ${config.maxBet} ${name}` };
    }
    if (bet > balance) {
      return { ok: false, message: `no te alcanza: tienes ${balance} ${name}` };
    }

    const now = Date.now();
    const wait = (this.lastSpin.get(id) ?? 0) + config.rouletteCooldownSeconds * 1000 - now;
    if (!ignoreCooldown && wait > 0) {
      return { ok: false, message: `espera ${Math.ceil(wait / 1000)} s para volver a girar` };
    }
    if (this.spinning.has(id)) {
      return { ok: false, message: 'tu tirada anterior sigue en curso' };
    }

    this.spinning.add(id);
    try {
      // Descuento atómico: si entre tanto bajó el saldo, no se juega.
      const charged = await this.prisma.pointsBalance.updateMany({
        where: { username: id, balance: { gte: bet } },
        data: { balance: { decrement: bet } },
      });
      if (charged.count === 0) {
        return { ok: false, message: `no te alcanza: tienes ${await this.getBalance(username)} ${name}` };
      }
      this.lastSpin.set(id, now);

      const sectors = this.parseOutcomes(config.outcomes).filter((candidate) => candidate.weight > 0);
      const index = this.pick(sectors);
      const outcome = sectors[index];
      const payout = Math.floor(bet * outcome.multiplier);
      if (payout > 0) {
        await this.prisma.pointsBalance.update({ where: { username: id }, data: { balance: { increment: payout } } });
      }
      const net = payout - bet;
      await this.prisma.pointsLog.create({
        data: { username: id, delta: net, reason: 'ruleta', note: `${outcome.label} · apostó ${bet}` },
      });
      const final = await this.getBalance(username);
      const spin: SpinEvent = {
        id: randomUUID(),
        username: (await this.prisma.pointsBalance.findUnique({ where: { username: id } }))?.displayName ?? username,
        bet,
        payout,
        net,
        balance: final,
        pointsName: name,
        outcomes: sectors.map(({ label, multiplier, weight }) => ({ label, multiplier, weight })),
        index,
      };
      this.eventEmitter.emit(PointsInternalEvent.SPIN, spin);
      const text =
        net > 0
          ? `🎰 ${outcome.label}: apostaste ${bet} y ganaste ${net}. Ahora tienes ${final} ${name}`
          : net === 0
            ? `🎰 ${outcome.label}: recuperas tus ${bet}. Tienes ${final} ${name}`
            : `🎰 ${outcome.label}: perdiste ${bet}. Te quedan ${final} ${name}`;
      return { ok: true, message: text };
    } finally {
      this.spinning.delete(id);
    }
  }

  /** Lanza una tirada de mentira (sin tocar saldos) para ver la animación en el overlay de OBS. */
  async previewSpin(): Promise<SpinEvent> {
    const config = await this.getConfig();
    const sectors = this.parseOutcomes(config.outcomes).filter((candidate) => candidate.weight > 0);
    const index = this.pick(sectors);
    const bet = Math.max(config.minBet, Math.min(config.maxBet, 100));
    const payout = Math.floor(bet * sectors[index].multiplier);
    const spin: SpinEvent = {
      id: randomUUID(),
      username: 'Prueba',
      bet,
      payout,
      net: payout - bet,
      balance: 1000 + payout - bet,
      pointsName: config.pointsName,
      outcomes: sectors.map(({ label, multiplier, weight }) => ({ label, multiplier, weight })),
      index,
    };
    this.eventEmitter.emit(PointsInternalEvent.SPIN, spin);
    return spin;
  }

  /** Índice del sector que cae, según los pesos. */
  private pick(outcomes: Outcome[]): number {
    const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < outcomes.length; i++) {
      roll -= outcomes[i].weight;
      if (roll < 0) {
        return i;
      }
    }
    return outcomes.length - 1;
  }
}
