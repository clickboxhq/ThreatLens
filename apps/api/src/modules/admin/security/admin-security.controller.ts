import { Controller, Get, Query } from '@nestjs/common';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { AdminSecurityService } from './admin-security.service';
import { PaginationQuery } from '../dto/pagination.query';
import { PlatformAdminOnly } from '../admin-guard.decorator';

class SecurityEventsQuery extends PaginationQuery {
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

@Controller('admin/security')
@PlatformAdminOnly()
export class AdminSecurityController {
  constructor(private readonly security: AdminSecurityService) {}

  @Get('overview')
  overview() {
    return this.security.getOverview();
  }

  @Get('events')
  events(@Query() query: SecurityEventsQuery) {
    return this.security.listEvents(query);
  }
}
