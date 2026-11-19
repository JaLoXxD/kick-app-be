import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { GoalsModule } from './goals/goals.module';
import { OverlaysModule } from './overlays/overlays.module';
import { KickModule } from './kick/kick.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { SpotifyModule } from './spotify/spotify.module';
import { TtsModule } from './tts/tts.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    SettingsModule,
    KickModule,
    TtsModule,
    AlertsModule,
    GoalsModule,
    OverlaysModule,
    SpotifyModule,
    VoiceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
