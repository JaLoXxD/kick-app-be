import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { KickModule } from '../kick/kick.module';
import { PointsCommandsService } from './points-commands.service';
import { PointsDuelsService } from './points-duels.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [AlertsModule, KickModule],
  controllers: [PointsController],
  providers: [PointsService, PointsCommandsService, PointsDuelsService],
  exports: [PointsService],
})
export class PointsModule {}
