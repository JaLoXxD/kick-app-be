import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChatSettings, SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AdminGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(): ChatSettings {
    return this.settingsService.get();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto): Promise<ChatSettings> {
    return this.settingsService.update(dto);
  }
}
