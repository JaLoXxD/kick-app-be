import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AlertConfig } from '@prisma/client';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../auth/admin.guard';
import { MEDIA_FILE_PATTERN } from './alert-media.util';
import { ALERT_TYPES, AlertType, MAX_IMAGE_BYTES } from './alerts.constants';
import { AlertsService, TriggerResult } from './alerts.service';
import { UpdateAlertConfigDto } from './dto/update-alert-config.dto';

/** Valida el segmento :type de la ruta contra los tipos de alerta existentes. */
const TypePipe = {
  transform(value: string): AlertType {
    if (!(ALERT_TYPES as readonly string[]).includes(value)) {
      throw new NotFoundException(`Tipo de alerta desconocido: ${value}`);
    }
    return value as AlertType;
  },
};

class TestAlertDto {
  @IsString()
  @Matches(/^[\w.-]{1,64}$/, { message: 'username inválido' })
  @MaxLength(64)
  @IsOptional()
  username?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  amount?: number;
}

const uploadOptions = { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } };

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get(':type')
  @UseGuards(AdminGuard)
  getConfig(@Param('type', TypePipe) type: AlertType): Promise<AlertConfig> {
    return this.alertsService.getConfig(type);
  }

  @Put(':type')
  @UseGuards(AdminGuard)
  update(@Param('type', TypePipe) type: AlertType, @Body() dto: UpdateAlertConfigDto): Promise<AlertConfig> {
    return this.alertsService.update(type, dto);
  }

  @Post(':type/image')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadImage(
    @Param('type', TypePipe) type: AlertType,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AlertConfig> {
    return this.alertsService.saveMedia(type, 'image', file);
  }

  @Delete(':type/image')
  @UseGuards(AdminGuard)
  removeImage(@Param('type', TypePipe) type: AlertType): Promise<AlertConfig> {
    return this.alertsService.removeMedia(type, 'image');
  }

  @Post(':type/audio')
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadAudio(
    @Param('type', TypePipe) type: AlertType,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AlertConfig> {
    return this.alertsService.saveMedia(type, 'audio', file);
  }

  @Delete(':type/audio')
  @UseGuards(AdminGuard)
  removeAudio(@Param('type', TypePipe) type: AlertType): Promise<AlertConfig> {
    return this.alertsService.removeMedia(type, 'audio');
  }

  /** Dispara una alerta de prueba (aunque esté desactivada). Requiere un overlay de alertas abierto. */
  @Post(':type/test')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  test(@Param('type', TypePipe) type: AlertType, @Body() dto: TestAlertDto): Promise<TriggerResult> {
    return this.alertsService.trigger(type, dto.username ?? 'UsuarioDePrueba', {
      test: true,
      amount: dto.amount,
    });
  }

  /**
   * Imágenes y audios de las alertas. Es público porque <img> y <audio> del overlay no pueden enviar
   * el token; los nombres son UUID aleatorios y solo se sirven tipos de imagen/audio.
   */
  @Get('media/:file')
  async media(@Param('file') file: string, @Res() res: Response): Promise<void> {
    if (!MEDIA_FILE_PATTERN.test(file)) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const path = resolve(this.alertsService.getMediaPath(file));
    await access(path).catch(() => {
      throw new NotFoundException();
    });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path);
  }
}
