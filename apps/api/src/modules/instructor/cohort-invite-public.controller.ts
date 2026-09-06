import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CohortInviteService } from './cohort-invite.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * The invitee's half of the flow, kept apart from the instructor controller because the two
 * have different audiences and different guards.
 *
 * Preview is deliberately unauthenticated — same pattern as the organisation invite preview and
 * the public certificate check. Someone arriving from an email has to be told what they are
 * being asked to join before they can be expected to sign in, and frequently has no account at
 * all yet. It returns only the cohort name, who invited them, and the address it was sent to.
 */
@Controller('cohort-invites')
export class CohortInvitePublicController {
  constructor(private readonly invites: CohortInviteService) {}

  @Get(':token')
  async preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  // Accepting does need an account: it enrols a specific user, so there has to be one.
  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.invites.accept(user, token);
  }
}
