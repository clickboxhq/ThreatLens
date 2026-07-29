import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { EvidenceNotesController } from './evidence-notes.controller';
import { EvidenceNotesService } from './evidence-notes.service';

@Module({
  controllers: [AlertsController, IncidentsController, EvidenceNotesController],
  providers: [AlertsService, IncidentsService, EvidenceNotesService],
})
export class InvestigationModule {}
