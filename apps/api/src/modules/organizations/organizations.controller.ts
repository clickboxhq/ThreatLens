import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import {
  CreateInviteDto,
  CreateOrganizationDto,
} from './dto/organizations.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// Phase 6 (merge plan): real org multi-tenancy. `getOwnedOrgId` inside the service enforces
// org_admin fine-grained access the same two-layer way instructor.controller.ts does — coarse
// role gating would work too, but org_admin already exists as a real, distinct role (see
// schema.prisma's UserRole), so no new guard decorator is needed here.
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(user, dto);
  }

  @Get('mine')
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.getMine(user);
  }

  @Get('mine/members')
  async listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listMembers(user);
  }

  @Get('mine/invites')
  async listInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.listInvites(user);
  }

  @Post('mine/invites')
  async createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.organizationsService.createInvite(user, dto);
  }

  @Post('invites/:token/accept')
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.organizationsService.acceptInvite(user, token);
  }
}
