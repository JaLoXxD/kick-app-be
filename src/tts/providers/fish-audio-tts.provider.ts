import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  TtsAudio,
  TtsInsufficientBalanceError,
  TtsProvider,
  TtsVoiceOptions,
} from '../tts.provider';

const FISH_TTS_URL = 'https://api.fish.audio/v1/tts';
const FISH_MIN_SPEED = 0.5;
const FISH_MAX_SPEED = 2;

@Injectable()
export class FishAudioTtsProvider implements TtsProvider {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async synthesize(text: string, options: TtsVoiceOptions): Promise<TtsAudio> {
    const apiKey = this.configService.get('tts.fishApiKey', { infer: true });
    if (!apiKey) {
      throw new Error('FISH_API_KEY no está configurada');
    }

    // El overlay sube/baja el tono reproduciendo a ratio = 2^(semitonos/12) sin preservar el tono,
    // lo que también acelera/ralentiza el audio. Se genera a speed/ratio para que la velocidad final no cambie.
    const pitchRatio = 2 ** (options.pitch / 12);
    const speed = Math.min(FISH_MAX_SPEED, Math.max(FISH_MIN_SPEED, options.speed / pitchRatio));

    const response = await fetch(FISH_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        model: this.configService.get('tts.fishModel', { infer: true }),
      },
      body: JSON.stringify({
        text,
        reference_id: options.fishVoiceId,
        format: 'mp3',
        mp3_bitrate: 64,
        latency: 'balanced',
        prosody: { speed },
      }),
    });

    if (response.status === 402) {
      throw new TtsInsufficientBalanceError();
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Fish Audio respondió ${response.status}: ${detail.slice(0, 200)}`);
    }

    return { audio: Buffer.from(await response.arrayBuffer()), mimeType: 'audio/mpeg' };
  }
}
