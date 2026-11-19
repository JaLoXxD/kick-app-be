import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { AdminGuard } from '../auth/admin.guard';
import { KickAuthService } from './kick-auth.service';
import { KickSubscriptionService } from './kick-subscription.service';
import { KickWebhookService } from './kick-webhook.service';
import { KickStatusEvent } from './kick.events';

@Controller('kick')
export class KickController {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly authService: KickAuthService,
    private readonly subscriptionService: KickSubscriptionService,
    private readonly webhookService: KickWebhookService,
  ) {}

  /** URL de Kick para autorizar la app. Solo el admin puede iniciarla: el callback reemplaza los tokens guardados. */
  @Get('auth/url')
  @UseGuards(AdminGuard)
  loginUrl(): { url: string } {
    return { url: this.authService.buildLoginUrl() };
  }

  @Get('auth/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('Faltan code o state');
    }
    await this.authService.handleCallback(code, state);

    let result: 'ok' | 'subscribe-error' = 'ok';
    let message = 'Kick autorizado y suscrito al chat. Ya puedes escribir en tu chat.';
    try {
      await this.subscriptionService.ensureSubscriptions();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'error desconocido';
      result = 'subscribe-error';
      message = `Kick autorizado, pero la suscripción al chat falló: ${reason}`;
    }

    const frontendUrl = this.configService.get('frontendUrl', { infer: true });
    if (frontendUrl) {
      res.redirect(`${frontendUrl}?kick=${result}`);
    } else {
      res.json({ message });
    }
  }

  @Get('status')
  status(): Promise<KickStatusEvent> {
    return this.subscriptionService.getStatus();
  }

  @Post('subscribe')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(): Promise<void> {
    await this.subscriptionService.ensureSubscriptions();
  }

  /** Endpoint público que Kick llama con cada evento (configurar como Webhook URL en la app de Kick). */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('kick-event-message-id') messageId: string | undefined,
    @Headers('kick-event-message-timestamp') timestamp: string | undefined,
    @Headers('kick-event-signature') signature: string | undefined,
    @Headers('kick-event-type') eventType: string | undefined,
  ): Promise<void> {
    if (!req.rawBody) {
      throw new BadRequestException('Cuerpo vacío');
    }
    await this.webhookService.handle({ messageId, timestamp, signature, eventType }, req.rawBody);
  }
}
