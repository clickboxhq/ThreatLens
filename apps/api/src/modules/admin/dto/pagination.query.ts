import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Shared page/limit/search for the admin list endpoints. The codebase has no global
// pagination convention (search / audit-logs / notifications each use a fixed take), so this
// stays small and local to the admin module rather than becoming a framework.
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export function toPage<T>(
  data: T[],
  total: number,
  query: { page: number; limit: number },
): Page<T> {
  return {
    data,
    page: query.page,
    limit: query.limit,
    total,
    hasMore: (query.page - 1) * query.limit + data.length < total,
  };
}
