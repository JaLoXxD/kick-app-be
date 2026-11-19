import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { ALERT_FONTS } from '../../alerts/alerts.constants';

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Estilo del texto, común a los overlays de texto. */
export class TextStyleDto {
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
