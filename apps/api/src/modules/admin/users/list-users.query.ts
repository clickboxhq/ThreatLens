import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQuery } from '../dto/pagination.query';
import type { UserRole, UserStatus } from '@prisma/client';

export class ListUsersQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['active', 'suspended', 'pending_verification'])
  status?: UserStatus;

  @IsOptional()
  @IsIn(['student', 'instructor', 'org_admin', 'platform_admin'])
  role?: UserRole;

  @IsOptional()
  @IsIn(['individual', 'organization'])
  membership?: 'individual' | 'organization';

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'name', 'lastActive'])
  sort: 'newest' | 'oldest' | 'name' | 'lastActive' = 'newest';
}
