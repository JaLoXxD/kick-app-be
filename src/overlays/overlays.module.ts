import { Module } from '@nestjs/common';
import { KickModule } from '../kick/kick.module';
import { DonorsService } from './donors.service';
import { OverlaysController } from './overlays.controller';
import { OverlaysService } from './overlays.service';
import { RotatorService } from './rotator.service';
import { SessionService } from './session.service';
import { WidgetsController } from './widgets.controller';

@Module({
  imports: [KickModule],
  // WidgetsController primero: sus rutas fijas deben registrarse antes que `overlays/:type`.
  controllers: [WidgetsController, OverlaysController],
  providers: [OverlaysService, SessionService, DonorsService, RotatorService],
  exports: [OverlaysService, SessionService, DonorsService, RotatorService],
})
export class OverlaysModule {}
