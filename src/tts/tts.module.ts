import { Module } from '@nestjs/common';
import { FishAudioTtsProvider } from './providers/fish-audio-tts.provider';
import { SpendTrackerService } from './spend-tracker.service';
import { OverlayPresenceService } from './overlay-presence.service';
import { TTS_PROVIDER } from './tts.provider';
import { TtsQueueService } from './tts-queue.service';

@Module({
  providers: [
    FishAudioTtsProvider,
    { provide: TTS_PROVIDER, useExisting: FishAudioTtsProvider },
    OverlayPresenceService,
    SpendTrackerService,
    TtsQueueService,
  ],
  exports: [TtsQueueService, TTS_PROVIDER, OverlayPresenceService, SpendTrackerService],
})
export class TtsModule {}
