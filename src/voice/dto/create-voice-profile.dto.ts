import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVoiceProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  @Matches(/^[\w-]{8,64}$/, { message: 'fishVoiceId inválido' })
  fishVoiceId!: string;

  @IsNumber()
  @Min(0.5)
  @Max(2)
  @IsOptional()
  speed?: number;

  @IsInt()
  @Min(-6)
  @Max(6)
  @IsOptional()
  pitch?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
