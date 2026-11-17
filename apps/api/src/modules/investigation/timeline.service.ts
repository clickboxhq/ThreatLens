import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { EventOwnershipService } from '../session-core/event-ownership.service';
import { AppException } from '../../common/exceptions/app-exception';
import { describeDirectoryAuditEvent } from '../../common/dto/directory-audit.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { AddToTimelineDto } from './dto/incident.dto';

export type TimelineEntityType = 'identity' | 'device' | 'mailbox';

export interface StudentTimelineItemDto {
  id: string;
  eventTable: string;
  occurredAt: Date;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  source: ('evidence' | 'manual')[];
  relatedItemIds: string[];
}

interface TimelineFact {
  occurredAt: Date;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
}

/**
 * Which timeline items belong together, as the student has decided it.
 *
 * `relatedItemIds` used to be derived from the generator's correlation_id — re-keyed so the
 * raw id never left the server, but still the answer: the graph drew the attack's shape before
 * the student had worked it out. Now two items are related when both are cited by alerts the
 * student escalated into the same incident. The graph draws what they connected, and the real
 * grouping is shown only in the debrief once the session is scored.
 *
 * Pure and exported for direct unit testing. `scope` lets the aggregate view keep incidents
 * apart: an alert id is only meaningful within its own incident's links.
 */
export function relatedByEscalatedAlerts<T extends { eventId: string }>(
  items: (T & { scope: string })[],
  links: { scope: string; alertId: string }[],
  evidenceRefs: { alertId: string; eventId: string }[],
): Map<T, string[]> {
  const alertIdsByEvent = new Map<string, string[]>();
  for (const ref of evidenceRefs) {
    const list = alertIdsByEvent.get(ref.eventId) ?? [];
    list.push(ref.alertId);
    alertIdsByEvent.set(ref.eventId, list);
  }
  const escalated = new Set(links.map((l) => `${l.scope} ${l.alertId}`));

  const itemIdsByScopedAlert = new Map<string, string[]>();
  for (const item of items) {
    for (const alertId of alertIdsByEvent.get(item.eventId) ?? []) {
      const key = `${item.scope} ${alertId}`;
      if (!escalated.has(key)) continue;
      const list = itemIdsByScopedAlert.get(key) ?? [];
      list.push(item.eventId);
      itemIdsByScopedAlert.set(key, list);
    }
  }

  const result = new Map<T, string[]>();
  for (const item of items) {
    const related = new Set<string>();
    for (const alertId of alertIdsByEvent.get(item.eventId) ?? []) {
      for (const id of itemIdsByScopedAlert.get(`${item.scope} ${alertId}`) ??
        []) {
        if (id !== item.eventId) related.add(id);
      }
    }
    result.set(item, [...related]);
  }
  return result;
}

// §2.9 Global Timeline. `GET /timeline` merges EvidenceCollection's source events with
// TimelineItem's manually-added events (§16.7) into one chronologically-sorted, swimlane-
// taggable view; `POST`/`DELETE /timeline` maintain the manually-added set. Deliberately does
// NOT reuse summarizeEvidenceRef (common/dto/evidence-summary.ts) even though the two overlap
// heavily in shape — this service needs the owning entity for the swimlane, which that
// multi-consumer helper has no reason to carry.
@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
    private readonly eventOwnership: EventOwnershipService,
  ) {}

  async addToTimeline(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: AddToTimelineDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);
    // Same reasoning as evidence pinning: the event id comes from the client and must be
    // confirmed to belong to this session, not merely to be a well-formed UUID.
    await this.eventOwnership.assertEventInSession(
      sessionId,
      dto.eventTable,
      dto.eventId,
    );

    const item = await this.prisma.timelineItem.upsert({
      where: {
        incidentId_eventTable_eventId: {
          incidentId,
          eventTable: dto.eventTable,
          eventId: dto.eventId,
        },
      },
      update: {},
      create: {
        incidentId,
        eventTable: dto.eventTable,
        eventId: dto.eventId,
        addedBy: user.id,
      },
    });

    await this.investigationActions.record({
      sessionId,
      incidentId,
      userId: user.id,
      actionType: 'add_to_timeline',
      targetType: dto.eventTable,
      targetId: dto.eventId,
    });

    return item;
  }

  // Keyed by (eventTable, eventId) rather than the TimelineItem row's own id — the merged
  // GET /timeline view's item id is deliberately the underlying event's id (shared identity
  // across evidence- and manually-sourced entries, §16.7), so the frontend never needs to
  // separately track TimelineItem's internal row id at all.
  async removeFromTimeline(
    sessionId: string,
    incidentId: string,
    eventTable: string,
    eventId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentEditable(sessionId, incidentId);
    await this.prisma.timelineItem.deleteMany({
      where: { incidentId, eventTable, eventId },
    });
  }

  async getTimeline(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ): Promise<StudentTimelineItemDto[]> {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.assertIncidentInSession(sessionId, incidentId);

    const [evidence, manual] = await Promise.all([
      this.prisma.evidenceCollection.findMany({ where: { incidentId } }),
      this.prisma.timelineItem.findMany({ where: { incidentId } }),
    ]);

    const sourcesByPointer = new Map<
      string,
      {
        eventTable: string;
        eventId: string;
        sources: Set<'evidence' | 'manual'>;
      }
    >();
    const addSource = (
      eventTable: string,
      eventId: string,
      source: 'evidence' | 'manual',
    ) => {
      const key = `${eventTable} ${eventId}`;
      const existing = sourcesByPointer.get(key);
      if (existing) existing.sources.add(source);
      else
        sourcesByPointer.set(key, {
          eventTable,
          eventId,
          sources: new Set([source]),
        });
    };
    for (const e of evidence) addSource(e.eventTable, e.eventId, 'evidence');
    for (const m of manual) addSource(m.eventTable, m.eventId, 'manual');

    const resolved = await Promise.all(
      [...sourcesByPointer.values()].map(async (pointer) => {
        const fact = await this.resolveFact(
          pointer.eventTable,
          pointer.eventId,
        );
        return fact ? { ...pointer, fact } : null;
      }),
    );
    const items = resolved
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ ...r, scope: incidentId }));

    const related = relatedByEscalatedAlerts(
      items,
      ...(await this.escalatedAlertLinks([incidentId])),
    );

    return items
      .map((item) => ({
        id: item.eventId,
        eventTable: item.eventTable,
        occurredAt: item.fact.occurredAt,
        entityType: item.fact.entityType,
        entityId: item.fact.entityId,
        entityLabel: item.fact.entityLabel,
        summary: item.fact.summary,
        source: [...item.sources],
        relatedItemIds: related.get(item) ?? [],
      }))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  /** The alerts escalated into these incidents, and every event those alerts cite. */
  private async escalatedAlertLinks(
    incidentIds: string[],
  ): Promise<
    [
      { scope: string; alertId: string }[],
      { alertId: string; eventId: string }[],
    ]
  > {
    const links = await this.prisma.incidentAlert.findMany({
      where: { incidentId: { in: incidentIds } },
      select: { incidentId: true, alertId: true },
    });
    if (links.length === 0) return [[], []];
    const refs = await this.prisma.alertEvidenceRef.findMany({
      where: { alertId: { in: [...new Set(links.map((l) => l.alertId))] } },
      select: { alertId: true, eventId: true },
    });
    return [
      links.map((l) => ({ scope: l.incidentId, alertId: l.alertId })),
      refs,
    ];
  }

  // §2.9's Global Timeline aggregate — the same evidence+manual merge as getTimeline, but
  // across every incident in every session this Student has ever run, not just one. Relation
  // grouping stays scoped per-incident even though this view spans many — an alert escalated
  // in one investigation says nothing about another.
  async listMine(user: AuthenticatedUser) {
    const incidents = await this.prisma.incident.findMany({
      where: { session: { userId: user.id } },
      include: { session: { include: { scenario: true } } },
    });
    if (incidents.length === 0) return [];

    const incidentIds = incidents.map((i) => i.id);
    const incidentById = new Map(incidents.map((i) => [i.id, i]));

    const [evidence, manual] = await Promise.all([
      this.prisma.evidenceCollection.findMany({
        where: { incidentId: { in: incidentIds } },
      }),
      this.prisma.timelineItem.findMany({
        where: { incidentId: { in: incidentIds } },
      }),
    ]);

    const sourcesByPointer = new Map<
      string,
      {
        incidentId: string;
        eventTable: string;
        eventId: string;
        sources: Set<'evidence' | 'manual'>;
      }
    >();
    const addSource = (
      incidentId: string,
      eventTable: string,
      eventId: string,
      source: 'evidence' | 'manual',
    ) => {
      const key = `${incidentId} ${eventTable} ${eventId}`;
      const existing = sourcesByPointer.get(key);
      if (existing) existing.sources.add(source);
      else
        sourcesByPointer.set(key, {
          incidentId,
          eventTable,
          eventId,
          sources: new Set([source]),
        });
    };
    for (const e of evidence)
      addSource(e.incidentId, e.eventTable, e.eventId, 'evidence');
    for (const m of manual)
      addSource(m.incidentId, m.eventTable, m.eventId, 'manual');

    const resolved = await Promise.all(
      [...sourcesByPointer.values()].map(async (pointer) => {
        const fact = await this.resolveFact(
          pointer.eventTable,
          pointer.eventId,
        );
        return fact ? { ...pointer, fact } : null;
      }),
    );
    const items = resolved
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => ({ ...r, scope: r.incidentId }));

    const related = relatedByEscalatedAlerts(
      items,
      ...(await this.escalatedAlertLinks(incidentIds)),
    );

    return items
      .map((item) => {
        const incident = incidentById.get(item.incidentId)!;
        return {
          id: item.eventId,
          incidentId: item.incidentId,
          incidentTitle: incident.title,
          sessionId: incident.sessionId,
          scenarioTitle: incident.session.scenario.title,
          eventTable: item.eventTable,
          occurredAt: item.fact.occurredAt,
          entityType: item.fact.entityType,
          entityId: item.fact.entityId,
          entityLabel: item.fact.entityLabel,
          summary: item.fact.summary,
          source: [...item.sources],
          relatedItemIds: related.get(item) ?? [],
        };
      })
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  private async resolveFact(
    eventTable: string,
    eventId: string,
  ): Promise<TimelineFact | null> {
    switch (eventTable) {
      case 'email_messages': {
        const email = await this.prisma.emailMessage.findUnique({
          where: { id: eventId },
        });
        if (!email) return null;
        const recipientUpn = (email.recipientAddresses[0] ?? '').toLowerCase();
        const identity = recipientUpn
          ? await this.prisma.identity.findFirst({
              where: {
                sessionId: email.sessionId,
                userPrincipalName: recipientUpn,
              },
            })
          : null;
        return {
          occurredAt: email.occurredAt,
          entityType: 'mailbox',
          entityId: identity?.id ?? email.id,
          entityLabel:
            identity?.displayName ??
            email.recipientAddresses[0] ??
            'Unknown mailbox',
          summary: `${email.direction === 'inbound' ? 'Received' : 'Sent'} email: "${email.subject}"`,
        };
      }
      case 'sign_in_events': {
        const event = await this.prisma.signInEvent.findUnique({
          where: { id: eventId },
          include: { identity: true },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'identity',
          entityId: event.identityId,
          entityLabel: event.identity.displayName,
          summary: `Sign-in from ${event.sourceCity}, ${event.sourceCountry} (${event.result})`,
        };
      }
      case 'cloud_events': {
        const event = await this.prisma.cloudEvent.findUnique({
          where: { id: eventId },
          include: { identity: true },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'identity',
          entityId: event.identityId,
          entityLabel: event.identity.displayName,
          summary: `Cloud action "${event.actionName}"`,
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
          occurredAt: event.occurredAt,
          entityType: 'device',
          entityId: event.deviceId,
          entityLabel: event.device.hostname,
          summary: `Process launched: "${imageName}"`,
        };
      }
      case 'file_events': {
        const event = await this.prisma.fileEvent.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'device',
          entityId: event.deviceId,
          entityLabel: event.device.hostname,
          summary: `File ${event.action}: ${event.filePath}`,
        };
      }
      case 'network_events': {
        const event = await this.prisma.networkEvent.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'device',
          entityId: event.deviceId,
          entityLabel: event.device.hostname,
          summary: `${event.direction} connection to ${event.remoteIp}:${event.remotePort}`,
        };
      }
      case 'http_requests': {
        const event = await this.prisma.httpRequest.findUnique({
          where: { id: eventId },
          include: { device: true },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'device',
          entityId: event.deviceId ?? event.id,
          entityLabel: event.device?.hostname ?? 'Unknown server',
          summary: `${event.method} ${event.url}`,
        };
      }
      // A pinned directory change used to resolve to nothing here and quietly drop off the
      // timeline — so an inbox rule or a new MFA method could be evidence and never appear in
      // the chronology it belongs in. It sits in the account's own lane.
      case 'directory_audit_events': {
        const event = await this.prisma.directoryAuditEvent.findUnique({
          where: { id: eventId },
          include: { targetIdentity: { select: { displayName: true } } },
        });
        if (!event) return null;
        return {
          occurredAt: event.occurredAt,
          entityType: 'identity',
          entityId: event.targetIdentityId,
          entityLabel: event.targetIdentity.displayName,
          summary: describeDirectoryAuditEvent(
            event,
            event.targetIdentity.displayName,
          ),
        };
      }
      default:
        return null;
    }
  }

  private async assertIncidentInSession(
    sessionId: string,
    incidentId: string,
  ): Promise<void> {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, sessionId },
    });
    if (!incident)
      throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
  }

  // §2.3: "Case status and verdict are immutable once submitted" — the same guard as
  // EvidenceNotesService.assertIncidentEditable, kept local rather than shared since these are
  // two independently-usable services and the check itself is a two-line query.
  private async assertIncidentEditable(
    sessionId: string,
    incidentId: string,
  ): Promise<void> {
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
