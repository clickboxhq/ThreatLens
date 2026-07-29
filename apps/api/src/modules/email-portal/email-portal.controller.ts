import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { EmailPortalService } from './email-portal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { EmailDirection, SpfResult } from '@prisma/client';

// §16.11
@Controller('sessions/:sessionId/emails')
@UseGuards(JwtAuthGuard)
export class EmailPortalController {
  constructor(private readonly service: EmailPortalService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('direction') direction?: EmailDirection,
    @Query('spfResult') spfResult?: SpfResult,
    @Query('sender') senderContains?: string,
    @Query('subject') subjectContains?: string,
  ) {
    return this.service.list(sessionId, user, { direction, spfResult, senderContains, subjectContains });
  }

  @Get(':id')
  async getMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getMessage(sessionId, id, user);
  }

  @Get(':id/similar')
  async getSimilar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getSimilar(sessionId, id, user);
  }
}
