import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { UpdateAlertStatusDto } from './dto/dismiss-alert.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { AlertSeverity, AlertStatus } from '@prisma/client';

// §16.5
@Controller('sessions/:sessionId/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Query('severity') severity?: AlertSeverity,
    @Query('status') status?: AlertStatus,
  ) {
    return this.alertsService.list(sessionId, user, { severity, status });
  }

  @Get(':id/evidence')
  async evidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.alertsService.getEvidence(sessionId, id, user);
  }

  @Patch(':id')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertStatusDto,
  ) {
    return this.alertsService.updateStatus(sessionId, id, user, dto);
  }
}
