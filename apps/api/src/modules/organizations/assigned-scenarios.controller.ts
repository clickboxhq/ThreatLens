import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrganizationScenariosService } from './organization-scenarios.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * Recipient-facing view — kept on its own top-level path rather than under
 * `/organizations/mine/*`, which reads as org_admin-only everywhere else (same reasoning as
 * announcements.controller.ts). The service enforces active org membership on every call; an
 * individual account or a removed/suspended member gets a 403, never a silently empty list.
 */
@Controller('assigned-scenarios')
@UseGuards(JwtAuthGuard)
export class AssignedScenariosController {
  constructor(
    private readonly organizationScenariosService: OrganizationScenariosService,
  ) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationScenariosService.listMyAssignedScenarios(user);
  }
}
