import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// GET /admin/analytics/customers — paginated revenue-by-customer list. The codebase has no
// shared pagination DTO yet (search / audit-logs / notifications each use a fixed `take`), so
// this is a small local one rather than a new framework.
export class CustomerAnalyticsQueryDto {
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

  // Matches against organization name, or an individual's display name / email
  // (case-insensitive contains).
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['individual', 'organization'])
  type?: 'individual' | 'organization';

  @IsOptional()
  @IsIn(['newest', 'oldest', 'name'])
  sort: 'newest' | 'oldest' | 'name' = 'newest';
}
