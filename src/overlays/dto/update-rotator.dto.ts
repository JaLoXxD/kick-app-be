import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ROTATOR_ITEMS } from '../overlays.constants';

export class UpdateRotatorDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ROTATOR_ITEMS.length)
  @IsIn(ROTATOR_ITEMS, { each: true })
  @IsOptional()
  items?: string[];

  @IsInt()
  @Min(2)
  @Max(120)
  @IsOptional()
  intervalSeconds?: number;
}
