# kick-app-be

Backend en **NestJS + Prisma (PostgreSQL)** para streams de Kick. Lee el chat en voz alta con voces de
**Fish Audio** y se encarga de alertas, metas, puntos con ruleta y duelos, comandos con costo, peticiones de
**Spotify** y control rápido del TTS. Recibe los eventos de Kick por webhook y los reparte por **Socket.IO** a los
overlays de OBS y al panel de administración ([kick-app-fe](https://github.com/JaLoXxD/kick-app-fe)).

## Funcionalidades

- **Kick:** autorización OAuth, webhooks firmados (chat, follows, suscripciones, subs regaladas y KICKs), ranking de
  KICKs y total de suscriptores desde la API, y respuestas del bot en el chat.
- **TTS:** voces de Fish Audio con perfiles (velocidad, tono, volumen), voces fijas por usuario, filtros de lectura,
  palabras prohibidas, usuarios silenciados y tope diario de caracteres.
- **Alertas** de seguidor, suscripción, subs regaladas y KICKs, con imagen, audio y voz.
- **Overlays:** último seguidor y suscriptor, contador de la sesión, top de donadores, rotador y metas de seguidores,
  KICKs y suscriptores.
- **Spotify:** `!play canción - artista` y `!revoke`, con cola propia, límites por usuario y por tiempo.
- **Puntos:** puntos por actividad, `!puntos`, ruleta con overlay animado, duelos `!duelo`, y comandos
  personalizados que cuestan puntos y reproducen una voz o un sonido (con permisos para todos, seguidores o suscriptores).
- **Control rápido del TTS:** saltar el mensaje en curso, silenciar a su autor, pausar y deshacer, con URLs con token
  para teclas, macros o el móvil.

## Requisitos

- Node.js 22 o superior
- PostgreSQL 15 o superior
- Una app de Kick ([kick.com/settings/developer](https://kick.com/settings/developer)) y, para el TTS, una API key de
  [Fish Audio](https://fish.audio)
- Opcional: una app de Spotify con Premium para las peticiones de canciones

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completa las variables (ver abajo)
npx prisma migrate deploy   # crea las tablas
npm run start:dev
```

Kick exige URLs públicas para el redirect y el webhook: en desarrollo usa un túnel (Cloudflare Tunnel o ngrok)
hacia el puerto del backend y configura `https://TU-TUNEL/kick/webhook` como Webhook URL de la app.

## Variables de entorno

Las principales (todas en `.env.example`):

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `ADMIN_PASSWORD`, `JWT_SECRET` | Login del panel |
| `OVERLAY_TOKEN` | Token de las fuentes de navegador de OBS |
| `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_REDIRECT_URI` | App de Kick |
| `KICK_EXTRA_SCOPES` | Permisos extra, p. ej. `chat:write kicks:read` (también deben marcarse en la app de Kick) |
| `FISH_API_KEY`, `FISH_MODEL` | TTS con Fish Audio |
| `TTS_*` | Modo de lectura, límites y tope diario de caracteres |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI` | Peticiones de Spotify (PKCE, sin secreto) |
| `CORS_ORIGIN`, `FRONTEND_URL`, `ALERTS_DIR` | Origen del frontend y carpeta de archivos subidos |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run start:dev` | Servidor con recarga |
| `npm run build` / `npm run start:prod` | Compila y ejecuta |
| `npm run prisma:migrate` | Crea una migración nueva en desarrollo |
| `npm run prisma:deploy` | Aplica las migraciones (producción) |
| `npm run prisma:studio` | Explorar la base de datos |

## Arquitectura

Cada funcionalidad es un módulo de NestJS en `src/`: `kick`, `tts`, `voice`, `chat`, `alerts`, `goals`, `overlays`,
`spotify`, `points`, `gateway`, `settings`, `auth` y `prisma`. Los módulos se hablan con eventos internos
(`EventEmitter2`): el webhook de Kick emite el evento, y cada módulo (TTS, alertas, metas, puntos...) reacciona por su
cuenta. El `gateway` publica el estado a los overlays por Socket.IO.

## Despliegue

En `deploy/` hay un `docker-compose` de producción (PostgreSQL + backend + frontend) y un snippet de Caddy como
proxy inverso bajo `/kick-tts`. Las migraciones se aplican al arrancar el contenedor.
