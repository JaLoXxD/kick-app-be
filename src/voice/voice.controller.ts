import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VoiceProfile, UserVoiceMapping } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { AssignVoiceDto } from './dto/assign-voice.dto';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { SearchVoicesDto } from './dto/search-voices.dto';
import { TestVoiceSpeechDto } from './dto/test-voice-speech.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { FishVoiceSearchPage, FishVoiceSearchService } from './fish-voice-search.service';
import { VoiceAssignmentService } from './voice-assignment.service';
import { VoicePreviewResult, VoicePreviewService } from './voice-preview.service';
import { VoiceProfileService } from './voice-profile.service';

@Controller('voices')
@UseGuards(AdminGuard)
export class VoiceController {
  constructor(
    private readonly voiceProfileService: VoiceProfileService,
    private readonly voiceAssignmentService: VoiceAssignmentService,
    private readonly voicePreviewService: VoicePreviewService,
    private readonly fishVoiceSearchService: FishVoiceSearchService,
  ) {}

  @Get()
  findAll(): Promise<VoiceProfile[]> {
    return this.voiceProfileService.findAll();
  }

  /** Busca voces en la biblioteca de Fish Audio para elegirlas sin salir del dashboard. */
  @Get('search')
  search(@Query() query: SearchVoicesDto): Promise<FishVoiceSearchPage> {
    return this.fishVoiceSearchService.search(query.q?.trim() ?? '', query.language ?? '', query.page ?? 1);
  }

  @Post()
  create(@Body() dto: CreateVoiceProfileDto): Promise<VoiceProfile> {
    return this.voiceProfileService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoiceProfileDto): Promise<VoiceProfile> {
    return this.voiceProfileService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.voiceProfileService.remove(id);
  }

  @Post(':id/speak')
  speak(@Param('id') id: string, @Body() dto: TestVoiceSpeechDto): Promise<VoicePreviewResult> {
    return this.voicePreviewService.speak(id, dto.text);
  }

  @Get('assignments')
  listAssignments(): Promise<(UserVoiceMapping & { voiceProfile: VoiceProfile })[]> {
    return this.voiceAssignmentService.listAssignments();
  }

  @Post('assignments')
  assign(@Body() dto: AssignVoiceDto): Promise<UserVoiceMapping> {
    return this.voiceAssignmentService.assign(dto);
  }

  @Delete('assignments/:kickUsername')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unassign(@Param('kickUsername') kickUsername: string): Promise<void> {
    await this.voiceAssignmentService.unassign(kickUsername);
  }
}
