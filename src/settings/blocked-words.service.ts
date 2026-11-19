import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { BlockedWord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockedWordMatcher, BlockedWordRule, MatchMode, tokenize } from './blocked-words';
import { DEFAULT_BLOCKED_WORDS, defaultMatchMode } from './default-blocked-words';
import { CreateBlockedWordDto, UpdateBlockedWordDto } from './dto/blocked-word.dto';

export interface BlockedWordTestResult {
  blocked: boolean;
  matched: BlockedWordRule | null;
}

/** Lista de palabras prohibidas editable desde el dashboard; el filtro del chat y las alertas la consultan aquí. */
@Injectable()
export class BlockedWordsService implements OnModuleInit {
  private matcher = new BlockedWordMatcher([]);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /** ¿El texto (mensaje o nombre de usuario) contiene alguna palabra prohibida activa? */
  isBlocked(text: string): boolean {
    return this.matcher.isBlocked(text);
  }

  /** Igual que isBlocked, pero dice qué regla lo bloqueó (para el probador del dashboard). */
  test(text: string): BlockedWordTestResult {
    const matched = this.matcher.findMatch(text);
    return { blocked: matched !== null, matched };
  }

  list(): Promise<BlockedWord[]> {
    return this.prisma.blockedWord.findMany({ orderBy: [{ builtin: 'asc' }, { word: 'asc' }] });
  }

  async create(dto: CreateBlockedWordDto): Promise<BlockedWord> {
    const word = this.cleanWord(dto.word);
    const exists = await this.prisma.blockedWord.findUnique({ where: { word } });
    if (exists) {
      throw new ConflictException(`«${word}» ya está en la lista`);
    }
    const created = await this.prisma.blockedWord.create({
      data: { word, matchMode: dto.matchMode, builtin: false },
    });
    await this.reload();
    return created;
  }

  async update(id: string, dto: UpdateBlockedWordDto): Promise<BlockedWord> {
    const updated = await this.prisma.blockedWord
      .update({ where: { id }, data: { matchMode: dto.matchMode, enabled: dto.enabled } })
      .catch(() => {
        throw new NotFoundException('La palabra no existe');
      });
    await this.reload();
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.blockedWord.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('La palabra no existe');
    });
    await this.reload();
  }

  /** Vuelve a añadir las palabras de la lista base que falten; no toca las que ya existen ni las propias. */
  async restoreDefaults(): Promise<{ added: number }> {
    const { count } = await this.prisma.blockedWord.createMany({
      data: DEFAULT_BLOCKED_WORDS.map((word) => ({
        word: word.trim().toLowerCase(),
        matchMode: defaultMatchMode(word),
        builtin: true,
      })),
      skipDuplicates: true,
    });
    await this.reload();
    return { added: count };
  }

  private cleanWord(raw: string): string {
    const word = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!/\p{L}/u.test(word) || tokenize(word).length === 0) {
      throw new BadRequestException('La palabra debe tener al menos una letra');
    }
    return word;
  }

  private async reload(): Promise<void> {
    const rows = await this.prisma.blockedWord.findMany({ where: { enabled: true } });
    this.matcher = new BlockedWordMatcher(
      rows.map((row) => ({ word: row.word, matchMode: row.matchMode as MatchMode })),
    );
  }
}
