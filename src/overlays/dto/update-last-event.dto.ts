import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ALERT_FONTS } from '../../alerts/alerts.constants';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class UpdateLastEventDto {
  /** Se puede corregir a mano (por ejemplo para arrancar con tu último seguidor real). */
  @IsString()
  @MaxLength(64)
  @Matches(/^[\w.-]*$/, { message: 'lastUsername inválido' })
  @IsOptional()
  lastUsername?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  textTemplate?: string;

  @IsIn(ALERT_FONTS)
  @IsOptional()
  fontFamily?: string;

  @IsInt()
  @Min(12)
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
