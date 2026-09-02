import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { EventOwnershipService } from '../session-core/event-ownership.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CreateNoteDto,
  LogResponseActionDto,
  PinEvidenceDto,
} from './dto/incident.dto';

@Injectable()
export class EvidenceNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
    private readonly eventOwnership: EventOwnershipService,
  ) {}

  async pinEvidence(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: PinEvidenceDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);
    // The event id arrives from the client; confirm it belongs to this session rather than
    // trusting it because it parses as a UUID.
    await this.eventOwnership.assertEventInSession(
      sessionId,
      dto.eventTable,
      dto.eventId,
    );

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

  // Enriched with a display title/summary the same way TimelineService.getTimeline resolves
  // its items — the raw EvidenceCollection row only carries an (eventTable, eventId) pointer,
  // which isn't enough for a UI to render a pinned item's content without a second lookup per
  // row. Deliberately a separate, evidence-shaped resolver rather than a shared helper with
  // TimelineService's resolveFact (same call TimelineService's own comment already makes about
  // not reusing summarizeEvidenceRef for a similar reason) — both are small, and diverging is
  // safer than widening one shared, ground-truth-adjacent helper to serve two call sites.
  async listEvidence(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentInSession(sessionId, incidentId);
    const rows = await this.prisma.evidenceCollection.findMany({
      where: { incidentId },
      orderBy: { pinnedAt: 'asc' },
    });
    const resolved = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        display: await this.resolveDisplay(row.eventTable, row.eventId),
      })),
    );
    return resolved;
  }

  // §2.10's Evidence Locker aggregate — every artifact the Student has pinned across every
  // incident they've ever worked, newest first. There is no cross-session "evidence" table to
  // query directly, so this joins EvidenceCollection back to the incidents/sessions/scenarios
  // it belongs to, scoped to this user's own sessions only.
  async listMine(user: AuthenticatedUser) {
    const rows = await this.prisma.evidenceCollection.findMany({
      where: { incident: { session: { userId: user.id } } },
      include: {
        incident: { include: { session: { include: { scenario: true } } } },
      },
      orderBy: { pinnedAt: 'desc' },
    });
    if (rows.length === 0) return [];

    const techniqueIds = [
      ...new Set(
        rows
          .map((r) => r.mitreTechniqueId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const techniques = techniqueIds.length
      ? await this.prisma.mitreTechnique.findMany({
          where: { id: { in: techniqueIds } },
        })
      : [];
    const techniqueById = new Map(techniques.map((t) => [t.id, t]));

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        sessionId: row.incident.sessionId,
        scenarioTitle: row.incident.session.scenario.title,
        incidentId: row.incidentId,
        incidentTitle: row.incident.title,
        eventTable: row.eventTable,
        justification: row.justification,
        mitreTechnique: row.mitreTechniqueId
          ? (() => {
              const t = techniqueById.get(row.mitreTechniqueId as string);
              return t ? { techniqueId: t.techniqueId, name: t.name } : null;
            })()
          : null,
        pinnedAt: row.pinnedAt,
        display: await this.resolveDisplay(row.eventTable, row.eventId),
      })),
    );
  }

  private async resolveDisplay(
    eventTable: string,
    eventId: string,
  ): Promise<{ title: string; summary: string } | null> {
    switch (eventTable) {
      case 'sign_in_events': {
        const event = await this.prisma.signInEvent.findUnique({
          where: { id: eventId },
          include: { identity: true },
        });
        if (!event) return null;
        return {
          title: `Sign-in: ${event.identity.displayName}`,
          summary: `From ${event.sourceCity}, ${event.sourceCountry} (${event.result})`,
        };
      }
      case 'email_messages': {
        const email = await this.prisma.emailMessage.findUnique({
          where: { id: eventId },
        });
        if (!email) return null;
        return {
          title: email.subject,
          summary: `${email.direction === 'inbound' ? 'From' : 'To'} ${email.senderAddress}`,
        };
      }
      case 'cloud_events': {
        const event = await this.prisma.cloudEvent.findUnique({
          where: { id: eventId },
          include: { identity: true },
        });
        if (!event) return null;
        return {
          title: `Cloud action: ${event.actionName}`,
          summary: `${event.provider} · ${event.identity.displayName}`,
        };
      }
      case 'process_events': {
        const event = await this.prisma.processEvent.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        const imageName =
          event.imagePath.split(/[\\/]/).pop() ?? event.imagePath;
        return {
          title: `Process: ${imageName}`,
          summary: `${event.device.hostname} · ${event.commandLine}`,
        };
      }
      case 'file_events': {
        const event = await this.prisma.fileEvent.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          title: `File ${event.action}: ${event.filePath}`,
          summary: event.device.hostname,
        };
      }
      case 'network_events': {
        const event = await this.prisma.networkEvent.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          title: `${event.direction} connection to ${event.remoteIp}:${event.remotePort}`,
          summary: event.device.hostname,
        };
      }
      case 'http_requests': {
        const event = await this.prisma.httpRequest.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          title: `${event.method} ${event.url}`,
          summary: event.device?.hostname ?? 'Unknown server',
        };
      }
      default:
        return null;
    }
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

  // See LogResponseActionDto's own comment: this panel has no entity picker, so this only
  // ever records the audit-trail row (InvestigationAction) — it never mutates a specific
  // device/identity/email the way POST .../devices/:id/isolate does. `targetId` is the
  // incident itself, since there's no more specific entity to point at from here.
  async logResponseAction(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: LogResponseActionDto,
  ): Promise<{ logged: true }> {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);

    await this.investigationActions.record({
      sessionId,
      incidentId,
      userId: user.id,
      actionType: dto.actionType,
      targetType: dto.targetType,
      targetId: incidentId,
    });

    return { logged: true };
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
