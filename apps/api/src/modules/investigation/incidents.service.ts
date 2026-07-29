import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CloseIncidentDto, LinkAlertsDto, UpdateIncidentStatusDto } from './dto/incident.dto';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async create(sessionId: string, user: AuthenticatedUser, title: string) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.prisma.incident.create({ data: { sessionId, title } });
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

  async linkAlerts(sessionId: string, incidentId: string, user: AuthenticatedUser, dto: LinkAlertsDto) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const incident = await this.getIncidentOrThrow(sessionId, incidentId);

    const alerts = await this.prisma.alert.findMany({ where: { id: { in: dto.alertIds }, sessionId } });
    if (alerts.length !== dto.alertIds.length) {
      throw new AppException(400, 'INVALID_ALERT_IDS', 'One or more alert IDs do not belong to this session.');
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

  async updateStatus(sessionId: string, incidentId: string, user: AuthenticatedUser, dto: UpdateIncidentStatusDto) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getIncidentOrThrow(sessionId, incidentId);
    await this.prisma.incident.update({ where: { id: incidentId }, data: { status: dto.status } });
    return this.toDto(incidentId);
  }

  async close(sessionId: string, incidentId: string, user: AuthenticatedUser, dto: CloseIncidentDto) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getIncidentOrThrow(sessionId, incidentId);

    const scenarioVersion = await this.prisma.scenarioVersion.findUniqueOrThrow({
      where: { id: session.scenarioVersionId },
    });
    const def = scenarioVersion.groundTruthDefinition as unknown as GroundTruthDefinition & {
      scoring_rubric: { min_evidence_items: number };
    };

    const evidenceCount = await this.prisma.evidenceCollection.count({ where: { incidentId } });
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
        data: { status: 'closed', verdict: dto.verdict, summary: dto.summary, closedAt: new Date() },
      }),
      ...dto.mitreTechniqueIds.map((mitreTechniqueId) =>
        this.prisma.incidentTechnique.upsert({
          where: { incidentId_mitreTechniqueId: { incidentId, mitreTechniqueId } },
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

    return this.toDto(incidentId);
  }

  private async getIncidentOrThrow(sessionId: string, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({ where: { id: incidentId, sessionId } });
    if (!incident) throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
    return incident;
  }

  private async toDto(incidentId: string) {
    const incident = await this.prisma.incident.findUniqueOrThrow({
      where: { id: incidentId },
      include: { alertLinks: true, techniqueLinks: { include: { mitreTechnique: true } } },
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
