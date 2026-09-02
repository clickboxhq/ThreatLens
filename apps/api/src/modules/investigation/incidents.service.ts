import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { RealtimeEventsService } from '../../common/realtime/realtime-events.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CloseIncidentDto,
  LinkAlertsDto,
  UpdateIncidentStatusDto,
} from './dto/incident.dto';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';
import { tasksForCategory } from './investigation-tasks';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(sessionId: string, user: AuthenticatedUser, title: string) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.prisma.incident.create({
      data: { sessionId, title },
    });
    await this.publishStatusChanged(sessionId, incident.id, incident.status);
    return this.toDto(incident.id);
  }

  async getOne(sessionId: string, incidentId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getIncidentOrThrow(sessionId, incidentId);
    return this.toDto(incidentId);
  }

  async list(sessionId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incidents = await this.prisma.incident.findMany({
      where: { sessionId },
      include: { alertLinks: true },
      orderBy: { createdAt: 'desc' },
    });
    return incidents.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      verdict: i.verdict,
      linkedAlertCount: i.alertLinks.length,
      createdAt: i.createdAt,
      closedAt: i.closedAt,
    }));
  }

  async linkAlerts(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: LinkAlertsDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.getIncidentOrThrow(sessionId, incidentId);

    const alerts = await this.prisma.alert.findMany({
      where: { id: { in: dto.alertIds }, sessionId },
    });
    if (alerts.length !== dto.alertIds.length) {
      throw new AppException(
        400,
        'INVALID_ALERT_IDS',
        'One or more alert IDs do not belong to this session.',
      );
    }

    await this.prisma.$transaction([
      ...dto.alertIds.map((alertId) =>
        this.prisma.incidentAlert.upsert({
          where: { incidentId_alertId: { incidentId, alertId } },
          update: {},
          create: { incidentId, alertId },
        }),
      ),
      this.prisma.alert.updateMany({
        where: { id: { in: dto.alertIds }, status: 'new' },
        data: { status: 'in_progress' },
      }),
    ]);

    await this.investigationActions.record({
      sessionId,
      incidentId,
      userId: user.id,
      actionType: 'escalate_to_incident',
      targetType: 'incident',
      targetId: incidentId,
      metadata: { alertIds: dto.alertIds },
    });

    return this.toDto(incident.id);
  }

  async updateStatus(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: UpdateIncidentStatusDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.getIncidentOrThrow(sessionId, incidentId);
    // Without this, a learner could PATCH a closed incident's status back to 'open' and
    // reopen every other write path (evidence, timeline, notes, response actions, checklist)
    // that all correctly refuse writes once status is 'closed' — the one gap in that
    // otherwise-consistent boundary. The real reopen path is instructor-only and goes through
    // instructor.service.ts's own role-gated flow, not this endpoint.
    if (incident.status === 'closed') {
      throw new AppException(
        409,
        'INCIDENT_CLOSED',
        'This incident is closed. Ask an instructor to reopen it to change its status.',
      );
    }
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: dto.status },
    });
    await this.publishStatusChanged(sessionId, incidentId, dto.status);
    return this.toDto(incidentId);
  }

  async close(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    dto: CloseIncidentDto,
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getIncidentOrThrow(sessionId, incidentId);

    const scenarioVersion = await this.prisma.scenarioVersion.findUniqueOrThrow(
      {
        where: { id: session.scenarioVersionId },
      },
    );
    const def =
      scenarioVersion.groundTruthDefinition as unknown as GroundTruthDefinition & {
        scoring_rubric: { min_evidence_items: number };
      };

    const evidenceCount = await this.prisma.evidenceCollection.count({
      where: { incidentId },
    });
    if (evidenceCount < def.scoring_rubric.min_evidence_items) {
      throw new AppException(
        409,
        'INSUFFICIENT_EVIDENCE',
        `At least ${def.scoring_rubric.min_evidence_items} pieces of evidence are required to close this incident.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.incident.update({
        where: { id: incidentId },
        data: {
          status: 'closed',
          verdict: dto.verdict,
          summary: dto.summary,
          closedAt: new Date(),
        },
      }),
      ...dto.mitreTechniqueIds.map((mitreTechniqueId) =>
        this.prisma.incidentTechnique.upsert({
          where: {
            incidentId_mitreTechniqueId: { incidentId, mitreTechniqueId },
          },
          update: {},
          create: { incidentId, mitreTechniqueId },
        }),
      ),
    ]);

    await this.investigationActions.record({
      sessionId,
      incidentId,
      userId: user.id,
      actionType: 'submit_verdict',
      targetType: 'incident',
      targetId: incidentId,
      metadata: { verdict: dto.verdict },
    });
    // §6.22: `verdict_submitted` is one of the doc's own named example actions — a Student's
    // graded verdict is a grading-relevant, security-adjacent action, not just pedagogical
    // replay data (which is what investigationActions.record above covers).
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'verdict_submitted',
      targetType: 'incident',
      targetId: incidentId,
      metadata: { verdict: dto.verdict, sessionId },
    });

    await this.publishStatusChanged(sessionId, incidentId, 'closed');
    return this.toDto(incidentId);
  }

  // §16.16: minimal `{ id, status }` payload, exactly the shape the doc specifies for
  // incident.status_changed — unlike alert.new (which pushes the full DTO so a new row can
  // render immediately), a status flip is cheap for the client to react to by just refetching
  // incident detail over REST, keeping REST as the single place that DTO-shapes an incident.
  private async publishStatusChanged(
    sessionId: string,
    incidentId: string,
    status: string,
  ): Promise<void> {
    await this.realtimeEvents.publish(sessionId, {
      type: 'incident.status_changed',
      payload: { id: incidentId, status },
    });
  }

  // The investigation checklist for this incident: static, category-derived task definitions
  // (see investigation-tasks.ts) joined to whichever keys the analyst has ticked off. Returning
  // them together means the client never has to know the definitions, so adding or rewording a
  // step is a backend-only change.
  async listTasks(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.getIncidentOrThrow(sessionId, incidentId);

    const scenario = await this.prisma.attackScenario.findUniqueOrThrow({
      where: { id: session.scenarioId },
      select: { category: true },
    });

    const done = new Set(incident.completedTaskKeys);
    const tasks = tasksForCategory(scenario.category).map((task) => ({
      ...task,
      completed: done.has(task.key),
    }));

    return {
      tasks,
      completedCount: tasks.filter((t) => t.completed).length,
      totalCount: tasks.length,
    };
  }

  async setTaskCompletion(
    sessionId: string,
    incidentId: string,
    user: AuthenticatedUser,
    taskKey: string,
    completed: boolean,
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.getIncidentOrThrow(sessionId, incidentId);

    // A submitted case is a record of what the analyst concluded and how they got there;
    // letting the checklist move afterwards would rewrite that record.
    if (incident.status === 'closed') {
      throw new AppException(
        409,
        'INCIDENT_CLOSED',
        'This incident is closed and its checklist can no longer be changed.',
      );
    }

    const scenario = await this.prisma.attackScenario.findUniqueOrThrow({
      where: { id: session.scenarioId },
      select: { category: true },
    });
    const valid = new Set(
      tasksForCategory(scenario.category).map((t) => t.key),
    );
    if (!valid.has(taskKey)) {
      throw new AppException(
        400,
        'UNKNOWN_TASK',
        'That checklist step does not belong to this investigation.',
      );
    }

    const current = new Set(incident.completedTaskKeys);
    if (completed) current.add(taskKey);
    else current.delete(taskKey);

    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { completedTaskKeys: [...current] },
    });

    return this.listTasks(sessionId, incidentId, user);
  }

  private async getIncidentOrThrow(sessionId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, sessionId },
    });
    if (!incident)
      throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
    return incident;
  }

  private async toDto(incidentId: string) {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: {
        alertLinks: true,
        techniqueLinks: { include: { mitreTechnique: true } },
      },
    });
    return {
      id: incident.id,
      title: incident.title,
      status: incident.status,
      verdict: incident.verdict,
      summary: incident.summary,
      linkedAlertIds: incident.alertLinks.map((l) => l.alertId),
      techniques: incident.techniqueLinks.map((t) => ({
        id: t.mitreTechnique.id,
        techniqueId: t.mitreTechnique.techniqueId,
        name: t.mitreTechnique.name,
      })),
      createdAt: incident.createdAt,
      closedAt: incident.closedAt,
    };
  }
}
