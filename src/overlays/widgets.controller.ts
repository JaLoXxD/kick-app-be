import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { RotatorConfig, SessionCounter } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { UpdateDonorBoardDto } from './dto/update-donor-board.dto';
import { UpdateRotatorDto } from './dto/update-rotator.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { DonorBoardPayload, DonorsService } from './donors.service';
import { RotatorService } from './rotator.service';
import { SessionService } from './session.service';

/** Overlays con configuración propia. Va antes que OverlaysController para que `:type` no capture estas rutas. */
@Controller('overlays')
@UseGuards(AdminGuard)
export class WidgetsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly donorsService: DonorsService,
    private readonly rotatorService: RotatorService,
  ) {}

  @Get('session')
  getSession(): Promise<SessionCounter> {
    return this.sessionService.getConfig();
  }

  @Put('session')
  updateSession(@Body() dto: UpdateSessionDto): Promise<SessionCounter> {
    return this.sessionService.update(dto);
  }

  @Post('session/reset')
  @HttpCode(HttpStatus.OK)
  resetSession(): Promise<SessionCounter> {
    return this.sessionService.reset();
  }

  @Get('donors')
  getDonors(): Promise<DonorBoardPayload> {
    return this.donorsService.getBoard();
  }

  @Put('donors')
  updateDonors(@Body() dto: UpdateDonorBoardDto): Promise<DonorBoardPayload> {
    return this.donorsService.update(dto);
  }

  @Post('donors/reset')
  @HttpCode(HttpStatus.OK)
  resetDonors(): Promise<DonorBoardPayload> {
    return this.donorsService.reset();
  }

  @Get('rotator')
  getRotator(): Promise<RotatorConfig> {
    return this.rotatorService.getConfig();
  }

  @Put('rotator')
  updateRotator(@Body() dto: UpdateRotatorDto): Promise<RotatorConfig> {
    return this.rotatorService.update(dto);
  }
}
