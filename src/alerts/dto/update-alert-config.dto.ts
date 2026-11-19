import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ALERT_FONTS } from '../alerts.constants';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class UpdateAlertConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  textTemplate?: string;

  @IsBoolean()
  @IsOptional()
  ttsEnabled?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  ttsTemplate?: string;

  /** null = voz por defecto. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  @IsOptional()
  voiceProfileId?: string | null;

  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  durationSeconds?: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @IsOptional()
  minAmount?: number;

  @IsIn(ALERT_FONTS)
  @IsOptional()
  fontFamily?: string;

  @IsInt()
  @Min(16)
  @Max(120)
  @IsOptional()
  fontSize?: number;

  @Matches(HEX_COLOR, { message: 'textColor debe ser un color #rrggbb' })
  @IsOptional()
  textColor?: string;

  @Matches(HEX_COLOR, { message: 'variableColor debe ser un color #rrggbb' })
  @IsOptional()
  variableColor?: string;

  @Matches(HEX_COLOR, { message: 'outlineColor debe ser un color #rrggbb' })
  @IsOptional()
  outlineColor?: string;

  @IsInt()
  @Min(0)
  @Max(8)
  @IsOptional()
  outlineWidth?: number;
}
