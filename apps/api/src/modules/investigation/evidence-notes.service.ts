import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CreateNoteDto, PinEvidenceDto } from './dto/incident.dto';

@Injectable()
export class EvidenceNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async pinEvidence(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: PinEvidenceDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);

    const evidence = await this.prisma.evidenceCollection.create({
      data: {
        incidentId,
        eventTable: dto.eventTable,
        eventId: dto.eventId,
        justification: dto.justification,
        mitreTechniqueId: dto.mitreTechniqueId,
        pinnedBy: user.id,
      },
    });

    await this.investigationActions.record({
      sessionId,
      incidentId,
      userId: user.id,
      actionType: 'pin_evidence',
      targetType: dto.eventTable,
      targetId: dto.eventId,
    });

    return evidence;
  }

  async listEvidence(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentInSession(sessionId, incidentId);
    return this.prisma.evidenceCollection.findMany({
      where: { incidentId },
      orderBy: { pinnedAt: 'asc' },
    });
  }

  async removeEvidence(
    sessionId: string,
    incidentId: string,
    evidenceId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);
    await this.prisma.evidenceCollection.deleteMany({
      where: { id: evidenceId, incidentId },
    });
  }

  async createNote(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: CreateNoteDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);
    return this.prisma.analystNote.create({
      data: { incidentId, body: dto.body, createdBy: user.id },
    });
  }

  async listNotes(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentInSession(sessionId, incidentId);
    return this.prisma.analystNote.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listInstructorFeedback(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentInSession(sessionId, incidentId);
    const feedback = await this.prisma.instructorFeedback.findMany({
      where: { incidentId },
      include: { instructor: true },
      orderBy: { createdAt: 'asc' },
    });
    return feedback.map((f) => ({
      id: f.id,
      instructorDisplayName: f.instructor.displayName,
      rubricOverrides: f.rubricOverrides,
      comment: f.comment,
      reopenedSession: f.reopenedSession,
      createdAt: f.createdAt,
    }));
  }

  private async assertIncidentInSession(sessionId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, sessionId },
    });
    if (!incident)
      throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
  }

  // §2.3's acceptance criterion: "Case status and verdict are immutable once submitted except
  // via an explicit, audited instructor reopen action" — this is what actually makes a closed
  // incident's eventual report *final* rather than a snapshot of data that could still drift.
  private async assertIncidentEditable(sessionId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, sessionId },
    });
    if (!incident)
      throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
    if (incident.status === 'closed') {
      throw new AppException(
        409,
        'INCIDENT_CLOSED',
        'This incident is closed. Ask an instructor to reopen it to make further changes.',
      );
    }
  }
}
