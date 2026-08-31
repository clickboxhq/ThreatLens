import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { NetworkPortalService } from './network-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// Network Center — session-wide network telemetry, mirroring device-portal's
// GET .../network but across every device in the investigation at once.
@Controller('sessions/:sessionId/network')
@UseGuards(JwtAuthGuard)
export class NetworkPortalController {
  constructor(private readonly service: NetworkPortalService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('direction') direction?: string,
    @Query('remoteIp') remoteIp?: string,
  ) {
    return this.service.list(sessionId, user, { direction, remoteIp });
  }
}
