import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsIn(['all', 'command'])
  @IsOptional()
  readMode?: 'all' | 'command';

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @IsOptional()
  command?: string;

  @IsInt()
  @Min(1)
  @Max(300)
  @IsOptional()
  maxChars?: number;

  @IsInt()
  @Min(0)
  @Max(3600)
  @IsOptional()
  userCooldownSeconds?: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  dailyCharCap?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  volume?: number;

  @IsInt()
  @Min(0)
  @Max(20)
  @IsOptional()
  maxRepeatedChars?: number;

  @IsIn(['shorten', 'ignore'])
  @IsOptional()
  repeatAction?: 'shorten' | 'ignore';

  @IsBoolean()
  @IsOptional()
  normalizeVolume?: boolean;
}
