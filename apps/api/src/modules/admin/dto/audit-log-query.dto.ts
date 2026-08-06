import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

// §16.14 — GET /admin/audit-logs query filters (§6.22).
export class AuditLogQueryDto {
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
