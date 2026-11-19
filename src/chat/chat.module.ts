import { Module } from '@nestjs/common';
import { PointsModule } from '../points/points.module';
import { SpotifyModule } from '../spotify/spotify.module';
import { TtsModule } from '../tts/tts.module';
import { VoiceModule } from '../voice/voice.module';
import { ChatSimulatorController } from './chat-simulator.controller';
import { ChatFilterService } from './chat-filter.service';
import { ChatOrchestratorService } from './chat-orchestrator.service';
import { RemoteControlController, ControlTokenGuard } from './remote-control.controller';
import { TtsControlController } from './tts-control.controller';
import { TtsControlService } from './tts-control.service';
import { MutedUsersController } from './muted-users.controller';
import { MutedUsersService } from './muted-users.service';

@Module({
  imports: [PointsModule, SpotifyModule, TtsModule, VoiceModule],
  controllers: [ChatSimulatorController, MutedUsersController, TtsControlController, RemoteControlController],
  providers: [ChatFilterService, ChatOrchestratorService, MutedUsersService, TtsControlService, ControlTokenGuard],
})
export class ChatModule {}
