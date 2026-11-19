import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60_000;

@Controller('auth')
export class AuthController {
  /** Intentos fallidos por IP (en memoria): tras 5 fallos se bloquea 15 minutos. */
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<{ token: string }> {
    const key = req.ip ?? 'unknown';
    const entry = this.failures.get(key);
    if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILED_ATTEMPTS) {
      throw new HttpException('Demasiados intentos, espera 15 minutos', HttpStatus.TOO_MANY_REQUESTS);
    }

    try {
      const token = await this.authService.login(dto.password);
      this.failures.delete(key);
      return { token };
    } catch (error) {
      const current = entry && entry.resetAt > Date.now() ? entry : { count: 0, resetAt: Date.now() + LOCKOUT_MS };
      this.failures.set(key, { count: current.count + 1, resetAt: current.resetAt });
      throw error;
    }
  }

  /** Token fijo que va en la URL del overlay de OBS (no caduca; se rota cambiando OVERLAY_TOKEN). */
  @Get('overlay-token')
  @UseGuards(AdminGuard)
  overlayToken(): { token: string } {
    return { token: this.authService.getOverlayToken() };
  }
}
