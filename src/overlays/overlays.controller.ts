import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { LastEventOverlay } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { UpdateLastEventDto } from './dto/update-last-event.dto';
import { LAST_EVENT_TYPES, LastEventType } from './overlays.constants';
import { OverlaysService } from './overlays.service';

const TypePipe = {
  transform(value: string): LastEventType {
    if (!(LAST_EVENT_TYPES as readonly string[]).includes(value)) {
      throw new NotFoundException(`Tipo de overlay desconocido: ${value}`);
    }
    return value as LastEventType;
  },
};

@Controller('overlays')
@UseGuards(AdminGuard)
export class OverlaysController {
  constructor(private readonly overlaysService: OverlaysService) {}

  @Get(':type')
  get(@Param('type', TypePipe) type: LastEventType): Promise<LastEventOverlay> {
    return this.overlaysService.getConfig(type);
  }

  @Put(':type')
  update(@Param('type', TypePipe) type: LastEventType, @Body() dto: UpdateLastEventDto): Promise<LastEventOverlay> {
    return this.overlaysService.update(type, dto);
  }
}
