import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RotatorConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRotatorDto } from './dto/update-rotator.dto';
import { OverlaysInternalEvent, WIDGET_ID } from './overlays.constants';

@Injectable()
export class RotatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getConfig(): Promise<RotatorConfig> {
    return this.prisma.rotatorConfig.upsert({
      where: { id: WIDGET_ID },
      create: { id: WIDGET_ID },
      update: {},
    });
  }

  async update(dto: UpdateRotatorDto): Promise<RotatorConfig> {
    await this.getConfig();
    const config = await this.prisma.rotatorConfig.update({
      where: { id: WIDGET_ID },
      data: { ...dto, items: dto.items ? { set: [...new Set(dto.items)] } : undefined },
    });
    this.eventEmitter.emit(OverlaysInternalEvent.ROTATOR, config);
    return config;
  }
}
