import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §2.14/§2.19
@Controller('sessions/:sessionId/incidents/:incidentId/report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Get()
  async getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ) {
    return this.service.getReport(sessionId, incidentId, user);
  }
}

// §2.14's Reports list — every closed incident the Student has ever produced a final report
// for, across every session.
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsListController {
  constructor(private readonly service: ReportService) {}

  @Get('mine')
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMine(user);
  }
}
