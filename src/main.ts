import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Detrás de Caddy: req.ip debe ser la IP real del cliente (límite de intentos de login).
  app.set('trust proxy', 1);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({ origin: configService.get('corsOrigin', { infer: true }) });

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  Logger.log(`🚀 kick-custom-chatbot-BE escuchando en el puerto ${port}`, 'Bootstrap');
}

void bootstrap();
