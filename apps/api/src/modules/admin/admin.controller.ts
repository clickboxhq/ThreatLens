import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// §16.14 — Admin Service. Scoped to the audit-log read endpoint only; scenario
// publishing/org analytics/impersonation are a separate, unbuilt Admin Service surface.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  async listAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.listAuditLogs(query);
  }
}
