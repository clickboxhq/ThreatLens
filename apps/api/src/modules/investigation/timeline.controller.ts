import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { AddToTimelineDto } from './dto/incident.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.7/§2.9
@Controller('sessions/:sessionId/incidents/:incidentId/timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

  @Post()
  async addToTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: AddToTimelineDto,
  ) {
    return this.service.addToTimeline(sessionId, incidentId, user, dto);
  }

  @Get()
  async getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.service.getTimeline(sessionId, incidentId, user);
  }

  @Delete(':eventTable/:eventId')
  async removeFromTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Param('eventTable') eventTable: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    await this.service.removeFromTimeline(
      sessionId,
      incidentId,
      eventTable,
      eventId,
      user,
    );
    return { removed: true };
  }
}
