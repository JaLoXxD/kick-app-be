import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TestVoiceSpeechDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  text!: string;
}
