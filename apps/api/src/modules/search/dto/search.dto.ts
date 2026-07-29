import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SearchFilterDto {
  @IsString()
  field!: string;

  @IsString()
  value!: string;
}

export class SearchDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchFilterDto)
  filters?: SearchFilterDto[];

  @IsOptional()
  @IsString()
  freetext?: string;
}
