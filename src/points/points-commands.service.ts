import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PointsCommand } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { KickChatEvent, KickFollowEvent, KickInternalEvent } from '../kick/kick.events';
import { PrismaService } from '../prisma/prisma.service';
import { BlockedWordsService } from '../settings/blocked-words.service';
import { CreateCommandDto, UpdateCommandDto } from './dto/points.dto';
import { PointsService } from './points.service';

const EMOTE_PATTERN = /\[emote:\d+:[^\]]*\]/g;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
const MAX_MESSAGE_CHARS = 120;
const SUBSCRIBER_BADGES = ['subscriber', 'founder', 'og'];
/** Estos roles pasan cualquier restricción de audiencia. */
const PRIVILEGED_BADGES = ['broadcaster', 'moderator', 'vip', 'staff'];

const key = (username: string): string => username.trim().toLowerCase();

export interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * Comandos del chat que cuestan puntos y hacen sonar un audio y/o una voz en el overlay de alertas.
 * Se cobra solo si realmente se pudo reproducir algo.
 */
@Injectable()
export class PointsCommandsService implements OnModuleInit {
  private readonly logger = new Logger(PointsCommandsService.name);
  private commands: PointsCommand[] = [];
  private readonly lastUser = new Map<string, number>();
  private readonly lastGlobal = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly alerts: AlertsService,
    private readonly blockedWords: BlockedWordsService,
  ) {
    this.points.registerMatcher((text) => this.find(text) !== undefined);
  }

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.commands = await this.prisma.pointsCommand.findMany({ orderBy: { name: 'asc' } });
  }

  private find(text: string): PointsCommand | undefined {
    const first = text.trim().split(/\s+/)[0]?.toLowerCase();
    return this.commands.find((command) => command.enabled && command.name === first);
  }

  // ---------------------------------------------------------------- administración

  list(): Promise<PointsCommand[]> {
    return this.prisma.pointsCommand.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCommandDto): Promise<PointsCommand> {
    const name = await this.validName(dto.name);
    const { name: _name, ...fields } = dto;
    const created = await this.prisma.pointsCommand.create({ data: { ...this.clean(fields), name } });
    await this.reload();
    return created;
  }

  async update(id: string, dto: UpdateCommandDto): Promise<PointsCommand> {
    await this.get(id);
    const { name, ...fields } = dto;
    const data: Record<string, unknown> = this.clean(fields);
    if (name !== undefined) {
      data['name'] = await this.validName(name, id);
    }
    const updated = await this.prisma.pointsCommand.update({ where: { id }, data });
    await this.reload();
    return updated;
  }

  async remove(id: string): Promise<void> {
    const command = await this.get(id);
    await this.prisma.pointsCommand.delete({ where: { id } });
    await this.alerts.removeStoredFile(command.audioFile);
    await this.reload();
  }

  async setAudio(id: string, file: { buffer: Buffer; size: number } | undefined): Promise<PointsCommand> {
    const command = await this.get(id);
    const fileName = await this.alerts.storeAudio(file);
    const updated = await this.prisma.pointsCommand.update({ where: { id }, data: { audioFile: fileName } });
    await this.alerts.removeStoredFile(command.audioFile);
    await this.reload();
    return updated;
  }

  async removeAudio(id: string): Promise<PointsCommand> {
    const command = await this.get(id);
    const updated = await this.prisma.pointsCommand.update({ where: { id }, data: { audioFile: null } });
    await this.alerts.removeStoredFile(command.audioFile);
    await this.reload();
    return updated;
  }

  /** Reproduce el comando en el overlay sin cobrar ni aplicar esperas. */
  async test(id: string, message: string): Promise<TestResult> {
    const command = await this.get(id);
    if (!this.alerts.canPlay()) {
      return { ok: false, message: 'No hay un overlay de alertas abierto en OBS (o en el navegador)' };
    }
    const played = await this.play(command, 'Prueba', message || 'mensaje de prueba', 0);
    return played
      ? { ok: true, message: 'Enviado al overlay de alertas' }
      : { ok: false, message: 'No salió nada: activa el TTS o sube un sonido' };
  }

  private async get(id: string): Promise<PointsCommand> {
    const command = await this.prisma.pointsCommand.findUnique({ where: { id } });
    if (!command) {
      throw new NotFoundException('No existe ese comando');
    }
    return command;
  }

  private clean<T extends object>(fields: T): T {
    // El DTO transformado puede traer claves con `undefined`; no deben pisar los valores actuales.
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
  }

  private async validName(raw: string, ignoreId?: string): Promise<string> {
    const name = (raw.startsWith('!') ? raw : `!${raw}`).toLowerCase();
    const config = await this.points.getConfig();
    if (this.points.reservedCommands(config).includes(name)) {
      throw new BadRequestException(`${name} ya lo usa el sistema de puntos`);
    }
    const existing = await this.prisma.pointsCommand.findUnique({ where: { name } });
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Ya existe el comando ${name}`);
    }
    return name;
  }

  // ---------------------------------------------------------------- seguidores conocidos

  @OnEvent(KickInternalEvent.FOLLOW)
  async onFollow(event: KickFollowEvent): Promise<void> {
    const username = key(event.username);
    if (!username) {
      return;
    }
    await this.prisma.knownFollower
      .upsert({ where: { username }, create: { username }, update: {} })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------- chat

  @OnEvent(KickInternalEvent.CHAT)
  async handleChat(event: KickChatEvent): Promise<void> {
    const config = this.points.snapshot();
    if (!config?.enabled) {
      return;
    }
    const text = event.text.replace(EMOTE_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    const command = this.find(text);
    if (!command) {
      return;
    }
    try {
      await this.run(command, event.username, text.slice(command.name.length).trim(), event.badges ?? []);
    } catch (error) {
      this.logger.error(`Error con ${command.name} de @${event.username}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async run(command: PointsCommand, username: string, rawMessage: string, badges: string[]): Promise<void> {
    const id = key(username);
    const now = Date.now();

    if (!(await this.allowed(command, id, badges))) {
      await this.points.say(
        `@${username} ${command.name} es solo para ${command.audience === 'subscribers' ? 'suscriptores' : 'seguidores'}`,
      );
      return;
    }

    const userWait = (this.lastUser.get(`${command.id}:${id}`) ?? 0) + command.userCooldownSeconds * 1000 - now;
    const globalWait = (this.lastGlobal.get(command.id) ?? 0) + command.globalCooldownSeconds * 1000 - now;
    const wait = Math.max(userWait, globalWait);
    if (wait > 0) {
      await this.points.say(`@${username} ${command.name} estará disponible en ${Math.ceil(wait / 1000)} s`);
      return;
    }

    const playsSomething = (command.ttsEnabled && command.ttsTemplate.trim() !== '') || command.audioFile !== null;
    if (playsSomething && !this.alerts.canPlay()) {
      this.logger.warn(`${command.name} de @${username} omitido: no hay overlay de alertas abierto`);
      return;
    }

    if (!(await this.points.charge(username, command.cost, 'comando', command.name))) {
      const balance = await this.points.getBalance(username);
      await this.points.say(`@${username} ${command.name} cuesta ${command.cost}, tienes ${balance}`);
      return;
    }
    // Se reserva el turno antes de reproducir para que dos mensajes seguidos no cobren y suenen a la vez.
    this.lastUser.set(`${command.id}:${id}`, now);
    this.lastGlobal.set(command.id, now);

    if (playsSomething) {
      const played = await this.play(command, username, this.cleanMessage(rawMessage), command.cost);
      if (!played) {
        await this.points.credit(username, command.cost, 'reembolso', command.name);
        this.lastUser.delete(`${command.id}:${id}`);
        this.lastGlobal.delete(command.id);
        this.logger.warn(`${command.name} de @${username} no se pudo reproducir: se devolvieron los puntos`);
        return;
      }
    }

    if (command.replyTemplate.trim()) {
      const balance = await this.points.getBalance(username);
      await this.points.say(this.render(command.replyTemplate, username, '', command.cost, balance));
    }
  }

  private async allowed(command: PointsCommand, id: string, badges: string[]): Promise<boolean> {
    if (command.audience === 'all' || badges.some((badge) => PRIVILEGED_BADGES.includes(badge))) {
      return true;
    }
    if (badges.some((badge) => SUBSCRIBER_BADGES.includes(badge))) {
      return true;
    }
    if (command.audience === 'followers') {
      return (await this.prisma.knownFollower.findUnique({ where: { username: id } })) !== null;
    }
    return false;
  }

  /** Lo que escribe el usuario después del comando; pasa por el filtro de palabras prohibidas. */
  private cleanMessage(raw: string): string {
    const text = raw.replace(URL_PATTERN, '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_CHARS);
    return this.blockedWords.isBlocked(text) ? '' : text;
  }

  private play(command: PointsCommand, username: string, message: string, cost: number): Promise<boolean> {
    return this.alerts.playCustom({
      username,
      audioFile: command.audioFile,
      ttsText:
        command.ttsEnabled && command.ttsTemplate.trim()
          ? this.render(command.ttsTemplate, username, message, cost, 0)
          : null,
      voiceProfileId: command.voiceProfileId,
    });
  }

  private render(template: string, username: string, message: string, cost: number, balance: number): string {
    return template
      .replace(/\{usuario\}/gi, username)
      .replace(/\{mensaje\}/gi, message)
      .replace(/\{costo\}/gi, String(cost))
      .replace(/\{saldo\}/gi, String(balance))
      .replace(/\s+/g, ' ')
      .trim();
  }
}
