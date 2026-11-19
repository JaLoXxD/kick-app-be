import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KickChatEvent, KickInternalEvent } from '../kick/kick.events';
import { PointsService } from './points.service';

const EMOTE_PATTERN = /\[emote:\d+:[^\]]*\]/g;

interface Challenge {
  challenger: string;
  target: string;
  bet: number;
  expiresAt: number;
}

const key = (username: string): string => username.trim().replace(/^@/, '').toLowerCase();

/** Duelos por chat: `!duelo @usuario 100`, el retado responde `!aceptar` o `!rechazar`. Gana uno al azar. */
@Injectable()
export class PointsDuelsService {
  /** Un reto pendiente por retado (clave: nombre en minúsculas). */
  private readonly pending = new Map<string, Challenge>();
  private readonly lastChallenge = new Map<string, number>();

  constructor(private readonly points: PointsService) {
    this.points.registerMatcher((text) => this.isDuelCommand(text));
  }

  private isDuelCommand(lower: string): boolean {
    const config = this.points.snapshot();
    if (!config?.duelsEnabled) {
      return false;
    }
    return [config.duelCommand, config.acceptCommand, config.declineCommand].some(
      (command) => lower === command || lower.startsWith(`${command} `),
    );
  }

  @OnEvent(KickInternalEvent.CHAT)
  async handleChat(event: KickChatEvent): Promise<void> {
    const config = this.points.snapshot();
    if (!config?.enabled || !config.duelsEnabled) {
      return;
    }
    const text = event.text.replace(EMOTE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    const lower = text.toLowerCase();
    const is = (command: string): boolean => lower === command || lower.startsWith(`${command} `);
    try {
      if (is(config.duelCommand)) {
        await this.challenge(event.username, text.slice(config.duelCommand.length).trim());
      } else if (is(config.acceptCommand)) {
        await this.accept(event.username);
      } else if (is(config.declineCommand)) {
        await this.decline(event.username);
      }
    } catch {
      // Un fallo en un duelo no debe afectar al chat.
    }
  }

  private async challenge(username: string, args: string): Promise<void> {
    const config = await this.points.getConfig();
    const [rawTarget, rawBet] = args.split(/\s+/);
    const target = key(rawTarget ?? '');
    const bet = /^\d+$/.test(rawBet ?? '') ? Number(rawBet) : NaN;
    const me = key(username);
    const name = config.pointsName;

    if (!target || Number.isNaN(bet)) {
      return this.points.say(`@${username} uso: ${config.duelCommand} @usuario <cantidad>`);
    }
    if (target === me) {
      return this.points.say(`@${username} no puedes retarte a ti mismo`);
    }
    if (bet < config.duelMinBet || bet > config.duelMaxBet) {
      return this.points.say(`@${username} la apuesta del duelo va de ${config.duelMinBet} a ${config.duelMaxBet} ${name}`);
    }
    const wait = (this.lastChallenge.get(me) ?? 0) + config.duelCooldownSeconds * 1000 - Date.now();
    if (wait > 0) {
      return this.points.say(`@${username} espera ${Math.ceil(wait / 1000)} s para lanzar otro reto`);
    }
    if ((await this.points.getBalance(username)) < bet) {
      return this.points.say(`@${username} no te alcanza: tienes ${await this.points.getBalance(username)} ${name}`);
    }
    if ((await this.points.getBalance(target)) < bet) {
      return this.points.say(`@${username} @${target} no tiene ${bet} ${name} para aceptar`);
    }
    this.purgeExpired();
    if (this.pending.has(target)) {
      return this.points.say(`@${username} @${target} ya tiene un reto pendiente`);
    }

    this.lastChallenge.set(me, Date.now());
    this.pending.set(target, {
      challenger: username,
      target,
      bet,
      expiresAt: Date.now() + config.duelTimeoutSeconds * 1000,
    });
    await this.points.say(
      `⚔️ @${target}, @${username} te reta a un duelo por ${bet} ${name}. ` +
        `Responde ${config.acceptCommand} o ${config.declineCommand} (${config.duelTimeoutSeconds} s)`,
    );
  }

  private async accept(username: string): Promise<void> {
    const config = await this.points.getConfig();
    const me = key(username);
    const challenge = this.pending.get(me);
    if (!challenge || challenge.expiresAt < Date.now()) {
      this.pending.delete(me);
      return this.points.say(`@${username} no tienes ningún reto pendiente`);
    }
    this.pending.delete(me);
    const { challenger, bet } = challenge;
    const name = config.pointsName;

    // Se cobra a los dos de forma atómica; si el segundo no alcanza, se devuelve al primero.
    if (!(await this.points.charge(challenger, bet, 'duelo', `contra ${username}`))) {
      return this.points.say(`@${username} @${challenger} ya no tiene ${bet} ${name}: duelo cancelado`);
    }
    if (!(await this.points.charge(username, bet, 'duelo', `contra ${challenger}`))) {
      await this.points.credit(challenger, bet, 'reembolso', 'duelo cancelado');
      return this.points.say(`@${username} no tienes ${bet} ${name}: duelo cancelado`);
    }

    const pot = bet * 2;
    const fee = Math.floor((pot * config.duelFeePercent) / 100);
    const challengerWins = Math.random() < 0.5;
    const winner = challengerWins ? challenger : username;
    const loser = challengerWins ? username : challenger;
    await this.points.credit(winner, pot - fee, 'duelo', `ganó a ${loser}`);
    await this.points.say(
      `⚔️ Duelo @${challenger} vs @${username} por ${bet} ${name}: ¡ganó @${winner}! (+${pot - fee - bet})`,
    );
  }

  private async decline(username: string): Promise<void> {
    const me = key(username);
    const challenge = this.pending.get(me);
    if (!challenge || challenge.expiresAt < Date.now()) {
      this.pending.delete(me);
      return;
    }
    this.pending.delete(me);
    await this.points.say(`@${challenge.challenger} @${username} rechazó el duelo`);
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [target, challenge] of this.pending) {
      if (challenge.expiresAt < now) {
        this.pending.delete(target);
      }
    }
  }
}
