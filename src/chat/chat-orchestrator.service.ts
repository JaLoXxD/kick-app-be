import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { KickChatEvent, KickInternalEvent } from '../kick/kick.events';
import { PointsService } from '../points/points.service';
import { SpotifyService } from '../spotify/spotify.service';
import { TtsQueueService } from '../tts/tts-queue.service';
import { VoiceAssignmentService } from '../voice/voice-assignment.service';
import { TtsControlService } from './tts-control.service';
import { ChatFilterService } from './chat-filter.service';

/**
 * Conecta los eventos de chat de Kick con el filtro, la resolución de voz y la cola de TTS.
 * El chat en pantalla (overlay) y el audio se emiten por separado: el texto se
 * muestra al instante (vía GatewayModule escuchando KickInternalEvent.CHAT),
 * mientras que el audio respeta el orden de la cola de reproducción.
 */
@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);

  constructor(
    private readonly chatFilterService: ChatFilterService,
    private readonly voiceAssignmentService: VoiceAssignmentService,
    private readonly ttsQueueService: TtsQueueService,
    private readonly spotifyService: SpotifyService,
    private readonly pointsService: PointsService,
    private readonly ttsControl: TtsControlService,
  ) {}

  @OnEvent(KickInternalEvent.CHAT)
  async handleChat(event: KickChatEvent): Promise<void> {
    this.logger.log(`Chat de @${event.username}: ${event.text}`);
    // Los comandos de música (!play, !revoke) no se leen en voz alta.
    if (this.spotifyService.isCommand(event.text) || this.pointsService.isCommand(event.text)) {
      return;
    }
    // En pausa el chat sigue en pantalla pero no se lee nada.
    if (this.ttsControl.isPaused()) {
      return;
    }
    const text = this.chatFilterService.prepare(event.username, event.text);
    if (!text) {
      this.logger.log(`Ignorado por el filtro (@${event.username})`);
      return;
    }

    try {
      const voice = await this.voiceAssignmentService.resolveVoiceForUser(event.username);
      this.ttsQueueService.enqueue({
        username: event.username,
        nickname: event.username,
        text,
        voiceName: voice.voiceName,
        volume: voice.volume,
        voice: { fishVoiceId: voice.fishVoiceId, speed: voice.speed, pitch: voice.pitch },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`No se pudo encolar el TTS de @${event.username}: ${message}`);
    }
  }
}
