import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const COMMAND = /^!?[\p{L}\p{N}_-]{1,20}$/u;
const BIG = 1_000_000_000;

export class OutcomeDto {
  @IsString()
  @MaxLength(30)
  label!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  multiplier!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weight!: number;
}

export class UpdatePointsConfigDto {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsString() @MaxLength(20) @IsOptional() pointsName?: string;
  @IsString() @Matches(COMMAND, { message: 'comando inválido' }) @IsOptional() pointsCommand?: string;
  @IsString() @Matches(COMMAND, { message: 'comando inválido' }) @IsOptional() rouletteCommand?: string;
  @IsInt() @Min(0) @Max(100_000) @IsOptional() perMessage?: number;
  @IsInt() @Min(0) @Max(3600) @IsOptional() messageCooldownSeconds?: number;
  @IsInt() @Min(0) @Max(BIG) @IsOptional() followBonus?: number;
  @IsInt() @Min(0) @Max(BIG) @IsOptional() subBonus?: number;
  @IsInt() @Min(0) @Max(BIG) @IsOptional() giftSubBonus?: number;
  @IsInt() @Min(0) @Max(100_000) @IsOptional() perKick?: number;
  @IsBoolean() @IsOptional() rouletteEnabled?: boolean;
  @IsInt() @Min(1) @Max(BIG) @IsOptional() minBet?: number;
  @IsInt() @Min(1) @Max(BIG) @IsOptional() maxBet?: number;
  @IsInt() @Min(0) @Max(3600) @IsOptional() rouletteCooldownSeconds?: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => OutcomeDto)
  @IsOptional()
  outcomes?: OutcomeDto[];

  @IsBoolean() @IsOptional() replyInChat?: boolean;

  @IsBoolean() @IsOptional() duelsEnabled?: boolean;
  @IsString() @Matches(COMMAND, { message: 'comando inválido' }) @IsOptional() duelCommand?: string;
  @IsString() @Matches(COMMAND, { message: 'comando inválido' }) @IsOptional() acceptCommand?: string;
  @IsString() @Matches(COMMAND, { message: 'comando inválido' }) @IsOptional() declineCommand?: string;
  @IsInt() @Min(1) @Max(BIG) @IsOptional() duelMinBet?: number;
  @IsInt() @Min(1) @Max(BIG) @IsOptional() duelMaxBet?: number;
  @IsInt() @Min(0) @Max(50) @IsOptional() duelFeePercent?: number;
  @IsInt() @Min(5) @Max(600) @IsOptional() duelTimeoutSeconds?: number;
  @IsInt() @Min(0) @Max(3600) @IsOptional() duelCooldownSeconds?: number;
}

/** Suma o resta puntos (delta negativo). */
export class AdjustPointsDto {
  @IsInt()
  @Min(-BIG)
  @Max(BIG)
  amount!: number;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  note?: string;
}

/** Fija el saldo exacto. */
export class SetPointsDto {
  @IsInt()
  @Min(0)
  @Max(BIG)
  balance!: number;
}

const AUDIENCES = ['all', 'followers', 'subscribers'] as const;

/** Campos editables de un comando de puntos (al crear, `name` es obligatorio). */
export class CommandFieldsDto {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsInt() @Min(0) @Max(BIG) @IsOptional() cost?: number;
  @IsIn(AUDIENCES as unknown as string[]) @IsOptional() audience?: string;
  @IsBoolean() @IsOptional() ttsEnabled?: boolean;
  @IsString() @MaxLength(200) @IsOptional() ttsTemplate?: string;
  @IsString() @IsOptional() voiceProfileId?: string | null;
  @IsInt() @Min(0) @Max(86_400) @IsOptional() userCooldownSeconds?: number;
  @IsInt() @Min(0) @Max(86_400) @IsOptional() globalCooldownSeconds?: number;
  @IsString() @MaxLength(300) @IsOptional() replyTemplate?: string;
}

export class CreateCommandDto extends CommandFieldsDto {
  @IsString()
  @Matches(COMMAND, { message: 'comando inválido (sin espacios, máx. 20 caracteres)' })
  name!: string;
}

export class UpdateCommandDto extends CommandFieldsDto {
  @IsString()
  @Matches(COMMAND, { message: 'comando inválido (sin espacios, máx. 20 caracteres)' })
  @IsOptional()
  name?: string;
}
