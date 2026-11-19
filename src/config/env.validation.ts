import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  @IsString()
  @IsOptional()
  KICK_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  KICK_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  KICK_REDIRECT_URI?: string;

  @IsString()
  @IsOptional()
  KICK_EXTRA_SCOPES?: string;

  @IsString()
  @IsOptional()
  SPOTIFY_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  SPOTIFY_REDIRECT_URI?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  FISH_API_KEY?: string;

  @IsString()
  @IsOptional()
  FISH_MODEL?: string;

  @IsString()
  @IsOptional()
  ALERTS_DIR?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  OVERLAY_TOKEN?: string;

  @IsIn(['all', 'command'])
  @IsOptional()
  TTS_READ_MODE?: string;

  @IsString()
  @IsOptional()
  TTS_COMMAND?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  TTS_MAX_CHARS?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  TTS_USER_COOLDOWN_SECONDS?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  TTS_DAILY_CHAR_CAP?: number;

  @IsString()
  @IsOptional()
  TTS_BLOCKED_WORDS?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Config validation error: ${errors.toString()}`);
  }

  return validatedConfig;
}
