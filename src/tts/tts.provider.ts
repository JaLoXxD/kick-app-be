export const TTS_PROVIDER = Symbol('TTS_PROVIDER');

export interface TtsVoiceOptions {
  /** ID de la voz en la biblioteca de Fish Audio. */
  fishVoiceId: string;
  /** Velocidad de habla, 0.5-2.0 (1 = normal). */
  speed: number;
  /** Tono en semitonos (-6 a 6). El proveedor compensa la velocidad; el cambio de tono lo aplica el reproductor. */
  pitch: number;
}

export interface TtsAudio {
  audio: Buffer;
  mimeType: string;
}

export interface TtsProvider {
  /** Sintetiza el texto y devuelve el audio generado. */
  synthesize(text: string, options: TtsVoiceOptions): Promise<TtsAudio>;
}

/** El saldo de la cuenta del proveedor se agotó (HTTP 402). */
export class TtsInsufficientBalanceError extends Error {
  constructor() {
    super('Saldo insuficiente en el proveedor de TTS');
  }
}
