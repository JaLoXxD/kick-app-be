import { Module } from '@nestjs/common';
import { TtsModule } from '../tts/tts.module';
import { FishVoiceSearchService } from './fish-voice-search.service';
import { VoiceAssignmentService } from './voice-assignment.service';
import { VoicePreviewService } from './voice-preview.service';
import { VoiceProfileService } from './voice-profile.service';
import { VoiceController } from './voice.controller';

@Module({
  imports: [TtsModule],
  controllers: [VoiceController],
  providers: [VoiceProfileService, VoiceAssignmentService, VoicePreviewService, FishVoiceSearchService],
  exports: [VoiceAssignmentService],
})
export class VoiceModule {}
