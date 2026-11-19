import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpotifyConfig } from '@prisma/client';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AppConfig } from '../config/configuration';
import { AdminRequestDto, UpdateSpotifyConfigDto } from './dto/update-spotify-config.dto';
import { SpotifyAuthService } from './spotify-auth.service';
import { RequestOutcome, SpotifyActivity, SpotifyService, SpotifyStatus } from './spotify.service';

@Controller('spotify')
export class SpotifyController {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly authService: SpotifyAuthService,
    private readonly spotify: SpotifyService,
  ) {}

  @Get('auth/url')
  @UseGuards(AdminGuard)
  loginUrl(): { url: string } {
    return { url: this.authService.buildLoginUrl() };
  }

  /** Spotify redirige aquí tras el login; el `state` lo emitió el backend, así que no necesita JWT. */
  @Get('auth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get('frontendUrl', { infer: true });
    const back = (result: string): string =>
      `${(frontendUrl ?? '').replace(/\/+$/, '')}/dashboard/spotify/peticiones?spotify=${result}`;

    if (error) {
      return void (frontendUrl ? res.redirect(back('denied')) : res.json({ message: `Spotify: ${error}` }));
    }
    if (!code || !state) {
      throw new BadRequestException('Faltan code o state');
    }
    await this.authService.handleCallback(code, state);
    if (frontendUrl) {
      res.redirect(back('ok'));
    } else {
      res.json({ message: 'Spotify autorizado' });
    }
  }

  @Delete('auth')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(): Promise<void> {
    return this.authService.disconnect();
  }

  @Get('status')
  @UseGuards(AdminGuard)
  status(): Promise<SpotifyStatus> {
    return this.spotify.getStatus();
  }

  @Get('config')
  @UseGuards(AdminGuard)
  getConfig(): Promise<SpotifyConfig> {
    return this.spotify.getConfig();
  }

  @Put('config')
  @UseGuards(AdminGuard)
  async updateConfig(@Body() dto: UpdateSpotifyConfigDto): Promise<SpotifyConfig> {
    try {
      return await this.spotify.updateConfig(dto);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Ajustes inválidos');
    }
  }

  @Get('queue')
  @UseGuards(AdminGuard)
  queue(): ReturnType<SpotifyService['getQueueView']> {
    return this.spotify.getQueueView();
  }

  /** Pide una canción desde el dashboard (sin límites por usuario), útil para probar. */
  @Post('request')
  @UseGuards(AdminGuard)
  request(@Body() dto: AdminRequestDto): Promise<RequestOutcome> {
    return this.spotify.requestSong('dashboard', dto.query, true);
  }

  @Delete('queue/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRequest(@Param('id') id: string): Promise<void> {
    return this.spotify.removeRequest(id);
  }

  @Delete('queue')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  clear(): Promise<void> {
    return this.spotify.clearPending();
  }

  @Post('skip')
  @UseGuards(AdminGuard)
  async skip(): Promise<{ ok: boolean }> {
    return { ok: await this.spotify.skip() };
  }
}

export type { SpotifyActivity };
