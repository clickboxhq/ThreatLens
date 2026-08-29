import { Controller, Get, UseGuards } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §2.9's Global Timeline — everything a Student has curated as relevant across every incident
// they've ever worked, not just one. Separate from TimelineController's per-incident routes
// since this is a cross-session aggregate, not a sub-resource of one incident.
@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class GlobalTimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.timelineService.listMine(user);
  }
}
