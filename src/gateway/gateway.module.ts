import { Module } from '@nestjs/common';
import { GoalsModule } from '../goals/goals.module';
import { OverlaysModule } from '../overlays/overlays.module';
import { TtsModule } from '../tts/tts.module';
import { OverlayGateway } from './overlay.gateway';

@Module({
  imports: [TtsModule, GoalsModule, OverlaysModule],
  providers: [OverlayGateway],
})
export class GatewayModule {}
