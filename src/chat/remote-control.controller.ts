import {
  All,
  CallHandler,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  MethodNotAllowedException,
  NestInterceptor,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { SkipTtsResult, TtsControlService, TtsControlStatus } from './tts-control.service';

/** Los atajos externos no tienen sesión: se identifican con el token de control (`?token=` o cabecera `x-control-token`). */
@Injectable()
export class ControlTokenGuard implements CanActivate {
  constructor(private readonly control: TtsControlService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // Solo GET y POST: un HEAD o un OPTIONS (precarga del navegador) no debe disparar acciones.
    if (request.method !== 'GET' && request.method !== 'POST') {
      throw new MethodNotAllowedException();
    }
    const fromQuery = typeof request.query['token'] === 'string' ? request.query['token'] : undefined;
    const fromHeader = request.headers['x-control-token'];
    const token = fromQuery ?? (typeof fromHeader === 'string' ? fromHeader : undefined);
    if (!this.control.isValidControlToken(token)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

/** Las respuestas del control no se guardan en caché. */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}

/**
 * Atajos para controlar el TTS sin salir del juego. Aceptan GET y POST para que sirvan tanto con un
 * `curl` como con un botón del Stream Deck o un marcador del móvil.
 */
@Controller('remote')
@UseGuards(ControlTokenGuard)
@UseInterceptors(NoStoreInterceptor)
export class RemoteControlController {
  constructor(private readonly control: TtsControlService) {}

  @Get('status')
  status(): TtsControlStatus {
    return this.control.status();
  }

  @All('skip')
  skip(): Promise<SkipTtsResult> {
    return this.control.skip(false);
  }

  @All('skip-mute')
  skipAndMute(): Promise<SkipTtsResult> {
    return this.control.skip(true);
  }

  @All('pause')
  pause(): TtsControlStatus {
    this.control.setPaused(true);
    return this.control.status();
  }

  @All('resume')
  resume(): TtsControlStatus {
    this.control.setPaused(false);
    return this.control.status();
  }

  /** Alterna pausa/reanudar con una sola tecla. */
  @All('toggle')
  toggle(): TtsControlStatus {
    this.control.setPaused(!this.control.isPaused());
    return this.control.status();
  }

  @All('unmute-last')
  unmuteLast(): Promise<{ username: string | null }> {
    return this.control.unmuteLast();
  }
}
