import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IdentityPortalService } from './identity-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  IdentityRiskLevel,
  MfaStatus,
  SignInResult,
} from '@prisma/client';

// §16.9
@Controller('sessions/:sessionId/identities')
@UseGuards(JwtAuthGuard)
export class IdentityPortalController {
  constructor(private readonly service: IdentityPortalService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('riskLevel') riskLevel?: IdentityRiskLevel,
    @Query('department') department?: string,
    @Query('mfaStatus') mfaStatus?: MfaStatus,
  ) {
    return this.service.list(sessionId, user, {
      riskLevel,
      department,
      mfaStatus,
    });
  }

  @Get(':id')
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getProfile(sessionId, id, user);
  }

  @Get(':id/signins')
  async getSignIns(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('result') result?: SignInResult,
    @Query('riskyOnly') riskyOnly?: string,
  ) {
    return this.service.getSignIns(sessionId, id, user, {
      result,
      riskyOnly: riskyOnly === 'true',
    });
  }

  @Get(':id/insights')
  async getInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getInsights(sessionId, id, user);
  }

  @Get(':id/audit-events')
  async getAuditEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAuditEvents(sessionId, id, user);
  }

  @Get(':id/cloud-events')
  async getCloudEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCloudEvents(sessionId, id, user);
  }
}
