import { Injectable } from '@nestjs/common';

/**
 * Cuenta los overlays (OBS) conectados. Si no hay ninguno, el audio no se sintetiza:
 * la API de TTS cobra por carácter y nadie lo escucharía.
 */
@Injectable()
export class OverlayPresenceService {
  private count = 0;
  private alertsCount = 0;

  overlayConnected(): void {
    this.count += 1;
  }

  overlayDisconnected(): void {
    this.count = Math.max(0, this.count - 1);
  }

  hasListeners(): boolean {
    return this.count > 0;
  }

  getCount(): number {
    return this.count;
  }

  /** Overlays de alertas (otra fuente de navegador en OBS). */
  alertsConnected(): void {
    this.alertsCount += 1;
  }

  alertsDisconnected(): void {
    this.alertsCount = Math.max(0, this.alertsCount - 1);
  }

  hasAlertListeners(): boolean {
    return this.alertsCount > 0;
  }
}
