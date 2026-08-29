import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThreatIntelService } from './threat-intel.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { IndicatorType } from '@prisma/client';

// §16.12 / §2.7 — scenario-scoped threat intel lookup, never a live external call (§1.6).
@Controller('sessions/:sessionId/threat-intel')
@UseGuards(JwtAuthGuard)
export class ThreatIntelController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Get()
  async lookup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('type') type: IndicatorType,
    @Query('value') value: string,
  ) {
    return this.threatIntelService.lookup(sessionId, user, type, value);
  }
}

// A Student's own cross-session threat-intel lookup history — see ThreatIntelService.listMine
// for why this can never become a way to browse a scenario's full indicator set.
@Controller('threat-intel')
@UseGuards(JwtAuthGuard)
export class ThreatIntelHistoryController {
  constructor(private readonly threatIntelService: ThreatIntelService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.threatIntelService.listMine(user);
  }
}
