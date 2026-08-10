import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DevicePortalService } from './device-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { DeviceRiskLevel } from '@prisma/client';

// §10, §16.10
@Controller('sessions/:sessionId/devices')
@UseGuards(JwtAuthGuard)
export class DevicePortalController {
  constructor(private readonly service: DevicePortalService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('riskLevel') riskLevel?: DeviceRiskLevel,
  ) {
    return this.service.list(sessionId, user, { riskLevel });
  }

  @Get(':id')
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getProfile(sessionId, id, user);
  }

  @Get(':id/process-tree')
  async getProcessTree(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getProcessTree(sessionId, id, user);
  }

  @Get(':id/files')
  async getFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getFiles(sessionId, id, user);
  }

  @Get(':id/network')
  async getNetwork(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getNetwork(sessionId, id, user);
  }

  @Get(':id/http-requests')
  async getHttpRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getHttpRequests(sessionId, id, user);
  }

  @Get(':id/timeline')
  async getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getTimeline(sessionId, id, user);
  }

  @Post(':id/isolate')
  async isolate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.isolate(sessionId, id, user);
  }
}
