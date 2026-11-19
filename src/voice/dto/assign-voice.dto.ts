import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class AssignVoiceDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^@?[\w.-]{1,64}$/, { message: 'kickUsername inválido' })
  kickUsername!: string;

  @IsUUID()
  voiceProfileId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  volume?: number;
}
