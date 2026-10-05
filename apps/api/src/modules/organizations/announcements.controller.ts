import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * Recipient-facing view. Anyone signed in can read the announcements addressed
 * to them; the service scopes the query to the caller's own org and cohort
 * enrolments, so this never leaks another tenant's announcements. Kept on its
 * own path (`/announcements/*`) rather than under `/organizations/mine/*`
 * because that prefix reads as org_admin-only everywhere else.
 */
@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listMyAnnouncements(user);
  }
}
