import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { AppException } from '../../common/exceptions/app-exception';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const VALID_PERIODS = ['weekly', 'monthly', 'all_time'];
const VALID_SCOPES = ['global', 'cohort'];

// §16.15, §13.5
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period') period = 'all_time',
    @Query('scope') scope = 'global',
    @Query('cohortId') cohortId?: string,
  ) {
    if (!VALID_PERIODS.includes(period)) {
      throw new AppException(
        400,
        'INVALID_PERIOD',
        'period must be weekly, monthly, or all_time.',
      );
    }
    if (!VALID_SCOPES.includes(scope)) {
      throw new AppException(
        400,
        'INVALID_SCOPE',
        'scope must be global or cohort.',
      );
    }
    return this.leaderboardService.get(
      user,
      period as 'weekly' | 'monthly' | 'all_time',
      scope as 'global' | 'cohort',
      cohortId,
    );
  }
}
