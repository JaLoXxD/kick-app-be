import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class SearchVoicesDto {
  @IsString()
  @MaxLength(80)
  @IsOptional()
  q?: string;

  /** Código de idioma (es, en…). Vacío o ausente = todos. */
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, { message: 'language inválido' })
  @IsOptional()
  language?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
}
