import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { AdminGuard } from '../auth/admin.guard';
import { KickChatEvent, KickInternalEvent } from '../kick/kick.events';

class SimulateChatDto {
  @IsString()
  @Matches(/^[\w.-]{1,64}$/, { message: 'username inválido' })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;

  /** Insignias de prueba (p. ej. ["subscriber"]) para probar comandos por rol. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badges?: string[];
}

/** Inyecta un comentario falso por el mismo camino que uno real, para probar overlay y voces sin Kick. */
@Controller('chat')
@UseGuards(AdminGuard)
export class ChatSimulatorController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post('simulate')
  @HttpCode(HttpStatus.NO_CONTENT)
  simulate(@Body() dto: SimulateChatDto): void {
    this.eventEmitter.emit(KickInternalEvent.CHAT, {
      messageId: randomUUID(),
      username: dto.username,
      text: dto.text,
      badges: dto.badges ?? [],
    } satisfies KickChatEvent);
  }
}
