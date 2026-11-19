import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const COMMAND = /^!?[\p{L}\p{N}_-]{1,20}$/u;

export class UpdateSpotifyConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @Matches(COMMAND, { message: 'comando inválido (sin espacios, máx. 20 caracteres)' })
  @IsOptional()
  playCommand?: string;

  @IsString()
  @Matches(COMMAND, { message: 'comando inválido (sin espacios, máx. 20 caracteres)' })
  @IsOptional()
  revokeCommand?: string;

  @IsInt()
  @Min(0)
  @Max(1440)
  @IsOptional()
  perUserWindowMinutes?: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  @IsOptional()
  minGapMinutes?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  maxQueueSize?: number;

  @IsInt()
  @Min(0)
  @Max(3600)
  @IsOptional()
  maxDurationSeconds?: number;

  @IsBoolean()
  @IsOptional()
  blockExplicit?: boolean;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? [...new Set(value.map((term) => String(term).trim()).filter(Boolean))]
      : value,
  )
  @IsOptional()
  blockedTerms?: string[];

  @IsInt()
  @Min(5)
  @Max(120)
  @IsOptional()
  leadSeconds?: number;

  @IsBoolean()
  @IsOptional()
  replyInChat?: boolean;
}

export class AdminRequestDto {
  @IsString()
  @MaxLength(200)
  query!: string;
}
