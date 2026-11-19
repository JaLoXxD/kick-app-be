import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { GoalConfig, LastEventOverlay, RotatorConfig, SessionCounter } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { KickChatEvent, KickInternalEvent, KickStatusEvent } from '../kick/kick.events';
import { AlertPlayPayload, AlertsInternalEvent } from '../alerts/alerts.constants';
import { PointsInternalEvent, SpinEvent } from '../points/points.constants';
import { GoalsInternalEvent } from '../goals/goals.constants';
import { GoalsService } from '../goals/goals.service';
import { LAST_EVENT_TYPES, OverlaysInternalEvent } from '../overlays/overlays.constants';
import { DonorBoardPayload, DonorsService } from '../overlays/donors.service';
import { OverlaysService } from '../overlays/overlays.service';
import { RotatorService } from '../overlays/rotator.service';
import { SessionService } from '../overlays/session.service';
import { AuthService } from '../auth/auth.service';
import { OverlayPresenceService } from '../tts/overlay-presence.service';
import { NowPlaying, TtsInternalEvent, TtsJobReadyPayload, TtsQueueService } from '../tts/tts-queue.service';

export const OverlaySocketEvent = {
  CHAT_MESSAGE: 'chat:message',
  KICK_STATUS: 'kick:status',
  TTS_OUT_OF_BALANCE: 'tts:out-of-balance',
  TTS_PLAY: 'tts:play',
  TTS_ENDED: 'tts:ended',
  ALERT_PLAY: 'alert:play',
  GOAL_UPDATE: 'goal:update',
  LAST_EVENT_UPDATE: 'last-event:update',
  SESSION_UPDATE: 'session:update',
  DONORS_UPDATE: 'donors:update',
  ROTATOR_UPDATE: 'rotator:update',
  ROULETTE_SPIN: 'roulette:spin',
  TTS_NOW: 'tts:now',
  TTS_SKIP: 'tts:skip',
  TTS_STATE: 'tts:state',
} as const;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' },
})
export class OverlayGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(OverlayGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly ttsQueueService: TtsQueueService,
    private readonly authService: AuthService,
    private readonly presence: OverlayPresenceService,
    private readonly goalsService: GoalsService,
    private readonly overlaysService: OverlaysService,
    private readonly sessionService: SessionService,
    private readonly donorsService: DonorsService,
    private readonly rotatorService: RotatorService,
  ) {}

  /** Acepta el token del overlay (OBS) o el JWT del admin (dashboard); cualquier otro se desconecta. */
  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { token?: string; role?: string } | undefined;
    const token = auth?.token;
    if (this.authService.isValidOverlayToken(token)) {
      // Dos fuentes de navegador distintas en OBS: la del chat ("overlay") y la de alertas ("alerts").
      // 'last-event' es el nombre anterior del rol: fuentes de OBS abiertas con la versión previa siguen funcionando.
      if (auth?.role === 'widgets' || auth?.role === 'last-event') {
        // Overlays de texto (último seguidor/suscriptor, sesión, top, rotador): reciben todo su estado al conectar.
        client.data.role = 'widgets';
        await this.emitWidgetState(client);
      } else if (auth?.role === 'goal') {
        // Barra de meta: no cuenta como overlay de chat/alertas; recibe el estado actual al conectar.
        client.data.role = 'goal';
        await this.emitGoals(client);
      } else if (auth?.role === 'roulette') {
        // Overlay de la ruleta: solo recibe las tiradas que ocurran mientras está conectado.
        client.data.role = 'roulette';
        void client.join('roulette');
      } else if (auth?.role === 'alerts') {
        client.data.role = 'alerts';
        void client.join('alerts');
        this.presence.alertsConnected();
      } else {
        client.data.role = 'overlay';
        void client.join('overlay');
        this.presence.overlayConnected();
      }
    } else if (await this.authService.verifyAdminToken(token)) {
      client.data.role = 'admin';
      void client.join('admin');
      client.emit(OverlaySocketEvent.TTS_NOW, this.ttsQueueService.getNowPlaying());
      await this.emitGoals(client);
      await this.emitWidgetState(client);
    } else {
      client.disconnect(true);
      return;
    }
    this.logger.log(`Cliente conectado (${client.data.role}): ${client.id}`);
  }

  /** Las metas (seguidores, KICKs y subs), una por mensaje. */
  private async emitGoals(client: Socket): Promise<void> {
    for (const goal of await this.goalsService.getAll()) {
      client.emit(OverlaySocketEvent.GOAL_UPDATE, goal);
    }
  }

  /** Estado actual de todos los overlays de texto, para quien se acaba de conectar. */
  private async emitWidgetState(client: Socket): Promise<void> {
    for (const type of LAST_EVENT_TYPES) {
      client.emit(OverlaySocketEvent.LAST_EVENT_UPDATE, await this.overlaysService.getConfig(type));
    }
    client.emit(OverlaySocketEvent.SESSION_UPDATE, await this.sessionService.getConfig());
    client.emit(OverlaySocketEvent.DONORS_UPDATE, await this.donorsService.getBoard());
    client.emit(OverlaySocketEvent.ROTATOR_UPDATE, await this.rotatorService.getConfig());
  }

  handleDisconnect(client: Socket): void {
    if (client.data.role === 'overlay') {
      this.presence.overlayDisconnected();
    } else if (client.data.role === 'alerts') {
      this.presence.alertsDisconnected();
    }
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage(OverlaySocketEvent.TTS_ENDED)
  handleTtsEnded(@MessageBody() jobId: string, @ConnectedSocket() client: Socket): void {
    if (client.data.role === 'overlay') {
      this.ttsQueueService.onPlaybackFinished(jobId);
    }
  }

  @OnEvent(KickInternalEvent.CHAT)
  broadcastChat(event: KickChatEvent): void {
    this.server.emit(OverlaySocketEvent.CHAT_MESSAGE, event);
  }

  @OnEvent(KickInternalEvent.STATUS)
  broadcastKickStatus(event: KickStatusEvent): void {
    this.server.emit(OverlaySocketEvent.KICK_STATUS, event);
  }

  @OnEvent(TtsInternalEvent.OUT_OF_BALANCE)
  broadcastOutOfBalance(payload: { message: string }): void {
    this.server.emit(OverlaySocketEvent.TTS_OUT_OF_BALANCE, payload);
  }

  @OnEvent(TtsInternalEvent.JOB_READY)
  broadcastTtsJob(payload: TtsJobReadyPayload): void {
    this.server.to('overlay').emit(OverlaySocketEvent.TTS_PLAY, payload);
  }

  /** El panel del streamer ve qué mensaje se está leyendo para poder saltarlo. */
  @OnEvent(TtsInternalEvent.NOW_PLAYING)
  broadcastNowPlaying(payload: NowPlaying | null): void {
    this.server.to('admin').emit(OverlaySocketEvent.TTS_NOW, payload);
  }

  /** Pausa o último silenciado cambiaron (p. ej. desde un atajo): el panel se actualiza solo. */
  @OnEvent(TtsInternalEvent.CONTROL)
  broadcastControlState(payload: { paused: boolean; lastMuted: string | null }): void {
    this.server.to('admin').emit(OverlaySocketEvent.TTS_STATE, payload);
  }

  @OnEvent(TtsInternalEvent.SKIP)
  broadcastSkip(payload: { jobId: string }): void {
    this.server.to('overlay').emit(OverlaySocketEvent.TTS_SKIP, payload.jobId);
  }

  @OnEvent(AlertsInternalEvent.PLAY)
  broadcastAlert(payload: AlertPlayPayload): void {
    this.server.to('alerts').emit(OverlaySocketEvent.ALERT_PLAY, payload);
  }

  @OnEvent(OverlaysInternalEvent.UPDATE)
  broadcastLastEvent(payload: LastEventOverlay): void {
    this.server.emit(OverlaySocketEvent.LAST_EVENT_UPDATE, payload);
  }

  @OnEvent(OverlaysInternalEvent.SESSION)
  broadcastSession(payload: SessionCounter): void {
    this.server.emit(OverlaySocketEvent.SESSION_UPDATE, payload);
  }

  @OnEvent(OverlaysInternalEvent.DONORS)
  broadcastDonors(payload: DonorBoardPayload): void {
    this.server.emit(OverlaySocketEvent.DONORS_UPDATE, payload);
  }

  @OnEvent(OverlaysInternalEvent.ROTATOR)
  broadcastRotator(payload: RotatorConfig): void {
    this.server.emit(OverlaySocketEvent.ROTATOR_UPDATE, payload);
  }

  @OnEvent(GoalsInternalEvent.UPDATE)
  broadcastGoal(payload: GoalConfig): void {
    this.server.emit(OverlaySocketEvent.GOAL_UPDATE, payload);
  }

  @OnEvent(PointsInternalEvent.SPIN)
  broadcastSpin(payload: SpinEvent): void {
    this.server.to('roulette').emit(OverlaySocketEvent.ROULETTE_SPIN, payload);
  }
}
