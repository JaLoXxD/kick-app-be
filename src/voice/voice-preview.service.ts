import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { TTS_PROVIDER, TtsInsufficientBalanceError, TtsProvider } from '../tts/tts.provider';
import { VoiceProfileService } from './voice-profile.service';

export interface VoicePreviewResult {
  audioBase64: string;
  mimeType: string;
  /** Tono en semitonos que el reproductor debe aplicar. */
  pitch: number;
}

/** Sintetiza texto arbitrario con una voz del catálogo, sin pasar por la cola de reproducción. */
@Injectable()
export class VoicePreviewService {
  constructor(
    private readonly voiceProfileService: VoiceProfileService,
    @Inject(TTS_PROVIDER) private readonly ttsProvider: TtsProvider,
  ) {}

  async speak(voiceId: string, text: string): Promise<VoicePreviewResult> {
    const voice = await this.voiceProfileService.findOneOrFail(voiceId);
    try {
      const { audio, mimeType } = await this.ttsProvider.synthesize(text, {
        fishVoiceId: voice.fishVoiceId,
        speed: voice.speed,
        pitch: voice.pitch,
      });
      return { audioBase64: audio.toString('base64'), mimeType, pitch: voice.pitch };
    } catch (error) {
      if (error instanceof TtsInsufficientBalanceError) {
        throw new HttpException(error.message, HttpStatus.PAYMENT_REQUIRED);
      }
      throw error;
    }
  }
}
