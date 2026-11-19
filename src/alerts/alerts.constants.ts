/** Fuentes disponibles para el texto de la alerta (se cargan desde Google Fonts en el frontend). */
export const ALERT_FONTS = [
  'Montserrat',
  'Quicksand',
  'Poppins',
  'Oswald',
  'Anton',
  'Bangers',
  'Luckiest Guy',
  'Fredoka',
  'Pacifico',
  'Press Start 2P',
] as const;

export const ALERT_TYPES = ['follow', 'kicks', 'subscription', 'gift'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/** Textos iniciales de cada alerta; {usuario} y {cantidad} (KICKs y subs regaladas) se reemplazan al mostrarla. */
export const ALERT_DEFAULTS: Record<AlertType, { textTemplate: string; ttsTemplate: string }> = {
  follow: {
    textTemplate: '¡{usuario} te está siguiendo!',
    ttsTemplate: 'Gracias por seguirme, {usuario}',
  },
  kicks: {
    textTemplate: '¡{usuario} envió {cantidad} KICKs!',
    ttsTemplate: 'Gracias {usuario} por los {cantidad} kicks',
  },
  subscription: {
    textTemplate: '¡{usuario} se suscribió!',
    ttsTemplate: 'Gracias por suscribirte, {usuario}',
  },
  gift: {
    textTemplate: '¡{usuario} regaló {cantidad} subs!',
    ttsTemplate: 'Gracias {usuario} por regalar {cantidad} subs',
  },
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

export const AlertsInternalEvent = {
  PLAY: 'alerts.play',
} as const;

export interface AlertStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  outlineColor: string;
  outlineWidth: number;
}

/** Trozo del texto de la alerta: las variables ({usuario}, {cantidad}) llevan su propio color. */
export interface AlertTextPart {
  text: string;
  variable: boolean;
}

/** Lo que recibe el overlay de alertas por Socket.IO para mostrar una alerta. */
export interface AlertPlayPayload {
  id: string;
  /** 'command' = comando de puntos (solo audio/TTS). */
  kind: AlertType | 'command';
  username: string;
  text: string;
  /** El mismo texto dividido para pintar las variables con `variableColor`. */
  textParts: AlertTextPart[];
  variableColor: string;
  imageFile: string | null;
  audioFile: string | null;
  ttsAudioBase64: string | null;
  ttsMimeType: string | null;
  ttsPitch: number;
  /** El overlay iguala la sonoridad de la voz del TTS. */
  normalize: boolean;
  durationSeconds: number;
  /** Volumen 0-100 de los ajustes globales; vale para el audio y para el TTS. */
  volume: number;
  style: AlertStyle;
}
