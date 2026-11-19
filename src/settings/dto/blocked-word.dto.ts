import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MATCH_MODES = ['contains', 'exact'] as const;

export class CreateBlockedWordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  word!: string;

  @IsIn(MATCH_MODES)
  matchMode!: 'contains' | 'exact';
}

export class UpdateBlockedWordDto {
  @IsIn(MATCH_MODES)
  @IsOptional()
  matchMode?: 'contains' | 'exact';

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class TestBlockedWordDto {
  @IsString()
  @MaxLength(500)
  text!: string;
}
