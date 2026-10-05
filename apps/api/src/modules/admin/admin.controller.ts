import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAnalyticsService } from './analytics/admin-analytics.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { CustomerAnalyticsQueryDto } from './dto/customer-analytics-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// §16.14 — Admin Service. Platform-operator-wide surface, gated to `platform_admin` at the
// class level: JwtAuthGuard establishes identity, RolesGuard + @Roles enforces the role, so an
// org_admin or instructor calling any route here gets a 403 rather than an org-scoped view.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAnalyticsService: AdminAnalyticsService,
  ) {}

  @Get('audit-logs')
  async listAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  // §16.14 — platform business metrics: registered users, registered organizations, and
  // revenue (via the billing seam — "not available" until a payment provider is connected).
  @Get('analytics/overview')
  async getAnalyticsOverview() {
    return this.adminAnalyticsService.getOverview();
  }

  // Paginated revenue-by-customer list — organizations and individual (org-less) users as
  // distinct billing customers.
  @Get('analytics/customers')
  async getAnalyticsCustomers(@Query() query: CustomerAnalyticsQueryDto) {
    return this.adminAnalyticsService.getCustomers(query);
  }

  // Platform Analytics tabs — real application data (no billing dependency).
  @Get('analytics/users')
  async getUserAnalytics() {
    return this.adminAnalyticsService.getUserAnalytics();
  }

  @Get('analytics/product')
  async getProductAnalytics() {
    return this.adminAnalyticsService.getProductAnalytics();
  }

  @Get('analytics/organizations')
  async getOrganizationAnalytics() {
    return this.adminAnalyticsService.getOrganizationAnalytics();
  }
}
