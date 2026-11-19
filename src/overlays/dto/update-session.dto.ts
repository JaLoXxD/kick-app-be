import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TextStyleDto } from './text-style.dto';

export class UpdateSessionDto extends TextStyleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @IsOptional()
  textTemplate?: string;
}
