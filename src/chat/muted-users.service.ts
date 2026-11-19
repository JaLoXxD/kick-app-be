import { Injectable, OnModuleInit } from '@nestjs/common';
import { MutedUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Minúsculas, sin "@" y con "_" como "-" (Kick convierte guiones bajos en guiones en el slug). */
export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase().replace(/[\s_]+/g, '-');
}

/**
 * Usuarios sin TTS. El filtro del chat consulta en cada mensaje, así que la lista
 * vive en memoria y se mantiene sincronizada con la base de datos.
 */
@Injectable()
export class MutedUsersService implements OnModuleInit {
  private readonly muted = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.mutedUser.findMany();
    rows.forEach((row) => this.muted.add(row.kickUsername));
  }

  isMuted(username: string): boolean {
    return this.muted.has(normalizeUsername(username));
  }

  list(): Promise<MutedUser[]> {
    return this.prisma.mutedUser.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async mute(username: string): Promise<MutedUser> {
    const kickUsername = normalizeUsername(username);
    const row = await this.prisma.mutedUser.upsert({
      where: { kickUsername },
      create: { kickUsername },
      update: {},
    });
    this.muted.add(kickUsername);
    return row;
  }

  async unmute(username: string): Promise<void> {
    const kickUsername = normalizeUsername(username);
    await this.prisma.mutedUser.deleteMany({ where: { kickUsername } });
    this.muted.delete(kickUsername);
  }
}
