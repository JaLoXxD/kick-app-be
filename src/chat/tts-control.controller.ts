import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { SkipTtsResult, TtsControlState, TtsControlService, TtsControlStatus } from './tts-control.service';

class SkipTtsDto {
  /** También quita el TTS a quien escribió el mensaje y borra sus mensajes en espera. */
  @IsBoolean()
  @IsOptional()
  muteUser?: boolean;
}

class PauseTtsDto {
  @IsBoolean()
  paused!: boolean;
}

/** Control rápido desde el panel (con la sesión del admin). */
@Controller('chat/tts')
@UseGuards(AdminGuard)
export class TtsControlController {
  constructor(private readonly control: TtsControlService) {}

  @Get('status')
  status(): TtsControlStatus {
    return this.control.status();
  }

  /** Token para los atajos externos (Stream Deck, macros, mando del móvil). */
  @Get('control-token')
  token(): { token: string } {
    return { token: this.control.getControlToken() };
  }

  @Post('skip')
  @HttpCode(HttpStatus.OK)
  skip(@Body() dto: SkipTtsDto): Promise<SkipTtsResult> {
    return this.control.skip(dto.muteUser === true);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  pause(@Body() dto: PauseTtsDto): TtsControlState {
    return this.control.setPaused(dto.paused);
  }

  @Post('unmute-last')
  @HttpCode(HttpStatus.OK)
  unmuteLast(): Promise<{ username: string | null }> {
    return this.control.unmuteLast();
  }
}
