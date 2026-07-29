import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CloseIncidentDto, CreateIncidentDto, LinkAlertsDto, UpdateIncidentStatusDto } from './dto/incident.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.6
@Controller('sessions/:sessionId/incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidentsService.create(sessionId, user, dto.title);
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.incidentsService.list(sessionId, user);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.incidentsService.getOne(sessionId, id, user);
  }

  @Post(':id/alerts')
  async linkAlerts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkAlertsDto,
  ) {
    return this.incidentsService.linkAlerts(sessionId, id, user, dto);
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    return this.incidentsService.updateStatus(sessionId, id, user, dto);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseIncidentDto,
  ) {
    return this.incidentsService.close(sessionId, id, user, dto);
  }
}
