import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { JoinCohortDto } from './dto/join-cohort.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Controller('cohorts')
@UseGuards(JwtAuthGuard)
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Post('join')
  async join(@CurrentUser() user: AuthenticatedUser, @Body() dto: JoinCohortDto) {
    return this.cohortsService.join(user, dto.joinCode);
  }

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.cohortsService.listMine(user);
  }

  @Get('mine/assignments')
  async listMyAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.cohortsService.listMyAssignments(user);
  }
}
