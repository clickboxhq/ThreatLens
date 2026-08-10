import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { IndicatorType } from '@prisma/client';

// §16.12 / §2.7 — scenario-scoped threat intel lookup, never a live external call (§1.6).
@Controller('sessions/:sessionId/threat-intel')
@UseGuards(JwtAuthGuard)
export class ThreatIntelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
  ) {}

  @Get()
  async lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('type') type: IndicatorType,
    @Query('value') value: string,
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const indicator = await this.prisma.threatIntelIndicator.findFirst({
      where: {
        scenarioVersionId: session.scenarioVersionId,
        indicatorType: type,
        value,
      },
    });
    if (!indicator) {
      return {
        value,
        type,
        reputation: 'unknown',
        actorAttribution: null,
        context: null,
      };
    }
    return {
      value: indicator.value,
      type: indicator.indicatorType,
      reputation: indicator.reputation,
      actorAttribution: indicator.actorAttribution,
      context: indicator.context,
    };
  }
}
