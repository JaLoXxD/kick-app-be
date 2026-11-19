import { Module } from '@nestjs/common';
import { KickApiService } from './kick-api.service';
import { KickChatService } from './kick-chat.service';
import { KickAuthService } from './kick-auth.service';
import { KickSubscriptionService } from './kick-subscription.service';
import { KickWebhookService } from './kick-webhook.service';
import { KickController } from './kick.controller';

@Module({
  controllers: [KickController],
  providers: [KickAuthService, KickApiService, KickChatService, KickSubscriptionService, KickWebhookService],
  exports: [KickApiService, KickChatService],
})
export class KickModule {}
