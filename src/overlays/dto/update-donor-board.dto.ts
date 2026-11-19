import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DONOR_PERIODS } from '../overlays.constants';
import { TextStyleDto } from './text-style.dto';

export class UpdateDonorBoardDto extends TextStyleDto {
  @IsString()
  @MaxLength(80)
  @IsOptional()
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  entryTemplate?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  limit?: number;

  @IsIn(DONOR_PERIODS)
  @IsOptional()
  period?: string;
}
