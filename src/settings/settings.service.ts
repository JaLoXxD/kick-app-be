import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, ReadMode } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ROW_ID = 'app';

export type RepeatAction = 'shorten' | 'ignore';

export interface ChatSettings {
  readMode: ReadMode;
  command: string;
  maxChars: number;
  userCooldownSeconds: number;
  dailyCharCap: number;
  /** Volumen de reproducción en el overlay, 0-100. */
  volume: number;
  /** Antispam: máximo de caracteres iguales seguidos; 0 = sin filtro. */
  maxRepeatedChars: number;
  /** 'shorten' acorta la repetición al máximo; 'ignore' descarta el mensaje. */
  repeatAction: RepeatAction;
  /** Iguala el volumen de todas las voces (la ganancia se calcula en el overlay). */
  normalizeVolume: boolean;
}

/** Ajustes editables desde el dashboard. Los valores del .env solo son los iniciales. */
@Injectable()
export class SettingsService implements OnModuleInit {
  private current: ChatSettings;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService<AppConfig, true>,
  ) {
    const defaults = configService.get('chat', { infer: true });
    this.current = {
      readMode: defaults.readMode,
      command: defaults.command,
      maxChars: defaults.maxChars,
      userCooldownSeconds: Math.round(defaults.userCooldownMs / 1000),
      dailyCharCap: defaults.dailyCharCap,
      volume: 100,
      maxRepeatedChars: 3,
      repeatAction: 'shorten',
      normalizeVolume: true,
    };
  }

  async onModuleInit(): Promise<void> {
    const row = await this.prisma.appSettings.findUnique({ where: { id: SETTINGS_ROW_ID } });
    if (row) {
      this.current = this.fromRow(row);
    }
  }

  get(): ChatSettings {
    return this.current;
  }

  async update(dto: UpdateSettingsDto): Promise<ChatSettings> {
    const next: ChatSettings = {
      readMode: dto.readMode ?? this.current.readMode,
      command: dto.command ?? this.current.command,
      maxChars: dto.maxChars ?? this.current.maxChars,
      userCooldownSeconds: dto.userCooldownSeconds ?? this.current.userCooldownSeconds,
      dailyCharCap: dto.dailyCharCap ?? this.current.dailyCharCap,
      volume: dto.volume ?? this.current.volume,
      maxRepeatedChars: dto.maxRepeatedChars ?? this.current.maxRepeatedChars,
      repeatAction: dto.repeatAction ?? this.current.repeatAction,
      normalizeVolume: dto.normalizeVolume ?? this.current.normalizeVolume,
    };
    const row = await this.prisma.appSettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      create: { id: SETTINGS_ROW_ID, ...next },
      update: next,
    });
    this.current = this.fromRow(row);
    return this.current;
  }

  private fromRow(row: {
    readMode: string;
    command: string;
    maxChars: number;
    userCooldownSeconds: number;
    dailyCharCap: number;
    volume: number;
    maxRepeatedChars: number;
    repeatAction: string;
    normalizeVolume: boolean;
  }): ChatSettings {
    return {
      readMode: row.readMode === 'command' ? 'command' : 'all',
      command: row.command,
      maxChars: row.maxChars,
      userCooldownSeconds: row.userCooldownSeconds,
      dailyCharCap: row.dailyCharCap,
      volume: row.volume,
      maxRepeatedChars: row.maxRepeatedChars,
      repeatAction: row.repeatAction === 'ignore' ? 'ignore' : 'shorten',
      normalizeVolume: row.normalizeVolume,
    };
  }
}
