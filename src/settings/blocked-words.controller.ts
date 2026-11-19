import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BlockedWord } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { BlockedWordTestResult, BlockedWordsService } from './blocked-words.service';
import { CreateBlockedWordDto, TestBlockedWordDto, UpdateBlockedWordDto } from './dto/blocked-word.dto';

@Controller('settings/blocked-words')
@UseGuards(AdminGuard)
export class BlockedWordsController {
  constructor(private readonly blockedWords: BlockedWordsService) {}

  @Get()
  list(): Promise<BlockedWord[]> {
    return this.blockedWords.list();
  }

  @Post()
  create(@Body() dto: CreateBlockedWordDto): Promise<BlockedWord> {
    return this.blockedWords.create(dto);
  }

  /** Probador: dice si un mensaje se bloquearía y con qué palabra, sin enviar nada. */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  test(@Body() dto: TestBlockedWordDto): BlockedWordTestResult {
    return this.blockedWords.test(dto.text);
  }

  @Post('restore-defaults')
  @HttpCode(HttpStatus.OK)
  restoreDefaults(): Promise<{ added: number }> {
    return this.blockedWords.restoreDefaults();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBlockedWordDto): Promise<BlockedWord> {
    return this.blockedWords.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.blockedWords.remove(id);
  }
}
