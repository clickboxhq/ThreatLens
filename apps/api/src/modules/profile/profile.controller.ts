import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §2.17/§13.2 — the learner's own Performance Overview. Authentication only: every route here
// reads the caller's own data (`user.id`), so there is nothing to gate by role and no way to
// ask for another user's record.
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('performance')
  async getPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getPerformance(user.id);
  }
}
