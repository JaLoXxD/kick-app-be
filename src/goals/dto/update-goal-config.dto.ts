import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ALERT_FONTS } from '../../alerts/alerts.constants';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_COUNT = 10_000_000;

export class UpdateGoalConfigDto {
  @IsInt()
  @Min(0)
  @Max(MAX_COUNT)
  @IsOptional()
  currentCount?: number;

  @IsInt()
  @Min(1)
  @Max(MAX_COUNT)
  @IsOptional()
  goalCount?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  textTemplate?: string;

  @IsIn(['bar', 'number'])
  @IsOptional()
  displayStyle?: string;

  @IsBoolean()
  @IsOptional()
  liquid?: boolean;

  @IsIn(['above', 'inside'])
  @IsOptional()
  textPosition?: string;

  @IsIn(ALERT_FONTS)
  @IsOptional()
  fontFamily?: string;

  @IsInt()
  @Min(12)
  @Max(96)
  @IsOptional()
  fontSize?: number;

  @Matches(HEX_COLOR, { message: 'textColor debe ser un color #rrggbb' })
  @IsOptional()
  textColor?: string;

  @Matches(HEX_COLOR, { message: 'outlineColor debe ser un color #rrggbb' })
  @IsOptional()
  outlineColor?: string;

  @IsInt()
  @Min(0)
  @Max(8)
  @IsOptional()
  outlineWidth?: number;

  @IsInt()
  @Min(120)
  @Max(1800)
  @IsOptional()
  barWidth?: number;

  @IsInt()
  @Min(10)
  @Max(160)
  @IsOptional()
  barHeight?: number;

  @IsInt()
  @Min(0)
  @Max(80)
  @IsOptional()
  barRadius?: number;

  @Matches(HEX_COLOR, { message: 'barColor debe ser un color #rrggbb' })
  @IsOptional()
  barColor?: string;

  @Matches(HEX_COLOR, { message: 'barColor2 debe ser un color #rrggbb' })
  @IsOptional()
  barColor2?: string;

  @Matches(HEX_COLOR, { message: 'trackColor debe ser un color #rrggbb' })
  @IsOptional()
  trackColor?: string;

  @Matches(HEX_COLOR, { message: 'borderColor debe ser un color #rrggbb' })
  @IsOptional()
  borderColor?: string;

  @IsInt()
  @Min(0)
  @Max(12)
  @IsOptional()
  borderWidth?: number;
}
