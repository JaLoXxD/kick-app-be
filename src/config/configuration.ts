export type ReadMode = 'all' | 'command';

export interface AppConfig {
  port: number;
  corsOrigin: string;
  /** URL del dashboard; tras el login con Kick se redirige allí. Sin ella, el callback responde JSON. */
  frontendUrl: string | undefined;
  kick: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    /** URL pública del callback OAuth, ej. https://xxxx.trycloudflare.com/kick/auth/callback */
    redirectUri: string | undefined;
    /** Permisos extra de Kick separados por espacio (p. ej. "chat:write" para responder en el chat). */
    extraScopes: string;
  };
  spotify: {
    clientId: string | undefined;
    /** URL pública del callback OAuth, ej. https://tu-dominio/kick-tts/spotify/auth/callback */
    redirectUri: string | undefined;
  };
  database: {
    url: string;
  };
  tts: {
    fishApiKey: string | undefined;
    fishModel: string;
  };
  alerts: {
    /** Carpeta donde se guardan las imágenes y audios de las alertas. */
    dir: string;
  };
  auth: {
    adminPassword: string | undefined;
    jwtSecret: string | undefined;
    overlayToken: string | undefined;
  };
  chat: {
    readMode: ReadMode;
    command: string;
    maxChars: number;
    userCooldownMs: number;
    dailyCharCap: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  frontendUrl: process.env.FRONTEND_URL,
  kick: {
    clientId: process.env.KICK_CLIENT_ID,
    clientSecret: process.env.KICK_CLIENT_SECRET,
    redirectUri: process.env.KICK_REDIRECT_URI,
    extraScopes: process.env.KICK_EXTRA_SCOPES ?? '',
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  tts: {
    fishApiKey: process.env.FISH_API_KEY,
    fishModel: process.env.FISH_MODEL ?? 's2.1-pro',
  },
  alerts: {
    dir: process.env.ALERTS_DIR ?? './alerts-data',
  },
  auth: {
    adminPassword: process.env.ADMIN_PASSWORD,
    jwtSecret: process.env.JWT_SECRET,
    overlayToken: process.env.OVERLAY_TOKEN,
  },
  chat: {
    readMode: process.env.TTS_READ_MODE === 'command' ? 'command' : 'all',
    command: process.env.TTS_COMMAND ?? '!tts',
    maxChars: parseInt(process.env.TTS_MAX_CHARS ?? '100', 10),
    userCooldownMs: parseInt(process.env.TTS_USER_COOLDOWN_SECONDS ?? '10', 10) * 1000,
    dailyCharCap: parseInt(process.env.TTS_DAILY_CHAR_CAP ?? '50000', 10),
  },
});
