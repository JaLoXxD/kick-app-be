import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PointsCommand, PointsConfig, PointsLog } from '@prisma/client';
import { MAX_AUDIO_BYTES } from '../alerts/alerts.constants';
import { AdminGuard } from '../auth/admin.guard';
import {
  AdjustPointsDto,
  CreateCommandDto,
  SetPointsDto,
  UpdateCommandDto,
  UpdatePointsConfigDto,
} from './dto/points.dto';
import { PointsCommandsService, TestResult } from './points-commands.service';
import { PointsService, RouletteResult, UserPoints } from './points.service';

type ConfigView = PointsConfig & { expectedReturn: number };

@Controller('points')
@UseGuards(AdminGuard)
export class PointsController {
  constructor(
    private readonly points: PointsService,
    private readonly commands: PointsCommandsService,
  ) {}

  private async view(config: PointsConfig): Promise<ConfigView> {
    return { ...config, expectedReturn: this.points.expectedReturn(config) };
  }

  @Get('config')
  async getConfig(): Promise<ConfigView> {
    return this.view(await this.points.getConfig());
  }

  @Put('config')
  async updateConfig(@Body() dto: UpdatePointsConfigDto): Promise<ConfigView> {
    try {
      return await this.view(await this.points.updateConfig(dto));
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Ajustes inválidos');
    }
  }

  /** Muestra una tirada de prueba en el overlay de OBS sin tocar ningún saldo. */
  @Post('roulette/preview')
  @HttpCode(HttpStatus.NO_CONTENT)
  async preview(): Promise<void> {
    await this.points.previewSpin();
  }

  @Get('users')
  users(
    @Query('search') search = '',
    @Query('take') take = '50',
    @Query('skip') skip = '0',
    @Query('sort') sort = 'balance',
  ) {
    const order = sort === 'earned' || sort === 'name' ? sort : 'balance';
    return this.points.listUsers(
      search.slice(0, 40),
      Math.min(200, Math.max(1, Number(take) || 50)),
      Math.max(0, Number(skip) || 0),
      order,
    );
  }

  @Get('log')
  log(): Promise<PointsLog[]> {
    return this.points.recentLog();
  }

  @Post('users/:username/adjust')
  async adjust(@Param('username') username: string, @Body() dto: AdjustPointsDto): Promise<UserPoints> {
    try {
      return await this.points.adjust(username, dto.amount, dto.note);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'No se pudo ajustar');
    }
  }

  @Put('users/:username')
  async set(@Param('username') username: string, @Body() dto: SetPointsDto): Promise<UserPoints> {
    return this.points.setBalance(username, dto.balance);
  }

  @Delete('users/:username')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('username') username: string): Promise<void> {
    return this.points.removeUser(username);
  }

  /** Gira la ruleta como un usuario (sin cooldown) para probar las probabilidades. */
  @Post('users/:username/spin')
  spin(@Param('username') username: string, @Body('bet') bet: string): Promise<RouletteResult> {
    return this.points.spin(username, String(bet ?? ''), true);
  }

  // ---------------------------------------------------------------- comandos que cuestan puntos

  @Get('commands')
  listCommands(): Promise<PointsCommand[]> {
    return this.commands.list();
  }

  @Post('commands')
  createCommand(@Body() dto: CreateCommandDto): Promise<PointsCommand> {
    return this.commands.create(dto);
  }

  @Put('commands/:id')
  updateCommand(@Param('id') id: string, @Body() dto: UpdateCommandDto): Promise<PointsCommand> {
    return this.commands.update(id, dto);
  }

  @Delete('commands/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCommand(@Param('id') id: string): Promise<void> {
    return this.commands.remove(id);
  }

  @Post('commands/:id/audio')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_AUDIO_BYTES } }))
  uploadCommandAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PointsCommand> {
    return this.commands.setAudio(id, file);
  }

  @Delete('commands/:id/audio')
  removeCommandAudio(@Param('id') id: string): Promise<PointsCommand> {
    return this.commands.removeAudio(id);
  }

  /** Reproduce el comando en el overlay sin cobrar ni esperas. Requiere un overlay de alertas abierto. */
  @Post('commands/:id/test')
  @HttpCode(HttpStatus.OK)
  testCommand(@Param('id') id: string, @Body('message') message?: string): Promise<TestResult> {
    return this.commands.test(id, String(message ?? '').slice(0, 120));
  }
}
