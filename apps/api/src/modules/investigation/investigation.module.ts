import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { EvidenceNotesController } from './evidence-notes.controller';
import { EvidenceNotesService } from './evidence-notes.service';
import { EvidenceLockerController } from './evidence-locker.controller';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';
import { GlobalTimelineController } from './global-timeline.controller';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [
    AlertsController,
    IncidentsController,
    EvidenceNotesController,
    EvidenceLockerController,
    TimelineController,
    GlobalTimelineController,
    ReportController,
  ],
  providers: [
    AlertsService,
    IncidentsService,
    EvidenceNotesService,
    TimelineService,
    ReportService,
  ],
})
export class InvestigationModule {}
