import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { RealtimeEventsService } from '../../common/realtime/realtime-events.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentAlertDto } from '../../common/dto/alert.dto';
import { summarizeEvidenceRef } from '../../common/dto/evidence-summary';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { UpdateAlertStatusDto } from './dto/dismiss-alert.dto';
import type { AlertSeverity, AlertStatus, Prisma } from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async list(
    sessionId: string,
    user: AuthenticatedUser,
    filters: { severity?: AlertSeverity; status?: AlertStatus },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const where: Prisma.AlertWhereInput = { sessionId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const alerts = await this.prisma.alert.findMany({
      where,
      include: { mitreTechnique: true },
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
    });
    const entityDisplayById = await this.resolveEntityDisplays(alerts);
    return alerts.map((alert) => ({
      ...toStudentAlertDto(alert),
      entityDisplay: entityDisplayById.get(alert.primaryEntityId) ?? null,
    }));
  }

  // The alert list is a triage queue — "who/what is this about" needs to read at a glance,
  // not require opening the alert. `mailbox` entities are stored under their owning identity's
  // id (rules.ts has no standalone mailbox table yet), so identity + mailbox share one lookup.
  private async resolveEntityDisplays(
    alerts: { primaryEntityType: string; primaryEntityId: string }[],
  ): Promise<Map<string, string>> {
    const identityIds = [
      ...new Set(
        alerts
          .filter(
            (a) =>
              a.primaryEntityType === 'identity' ||
              a.primaryEntityType === 'mailbox',
          )
          .map((a) => a.primaryEntityId),
      ),
    ];
    const deviceIds = [
      ...new Set(
        alerts
          .filter((a) => a.primaryEntityType === 'device')
          .map((a) => a.primaryEntityId),
      ),
    ];

    const [identities, devices] = await Promise.all([
      identityIds.length
        ? this.prisma.identity.findMany({
            where: { id: { in: identityIds } },
            select: { id: true, displayName: true },
          })
        : Promise.resolve([]),
      deviceIds.length
        ? this.prisma.device.findMany({
            where: { id: { in: deviceIds } },
            select: { id: true, hostname: true },
          })
        : Promise.resolve([]),
    ]);

    const displayById = new Map<string, string>();
    for (const identity of identities)
      displayById.set(identity.id, identity.displayName);
    for (const device of devices) displayById.set(device.id, device.hostname);
    return displayById;
  }

  async getEvidence(
    sessionId: string,
    alertId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, sessionId },
      include: { evidenceRefs: true },
    });
    if (!alert) throw new AppException(404, 'NOT_FOUND', 'Alert not found.');

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'alert',
      targetId: alertId,
    });

    const evidence = await Promise.all(
      alert.evidenceRefs.map((ref) =>
        summarizeEvidenceRef(this.prisma, ref.eventTable, ref.eventId),
      ),
    );

    return { alertId, evidence };
  }

  async updateStatus(
    sessionId: string,
    alertId: string,
    user: AuthenticatedUser,
    dto: UpdateAlertStatusDto,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const alert = await this.prisma.alert.findFirst({
      where: { id: alertId, sessionId },
    });
    if (!alert) throw new AppException(404, 'NOT_FOUND', 'Alert not found.');

    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: dto.status,
        dismissalReason:
          dto.status === 'dismissed'
            ? dto.dismissalReason
            : alert.dismissalReason,
      },
      include: { mitreTechnique: true },
    });

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: dto.status === 'dismissed' ? 'dismiss_alert' : 'view_entity',
      targetType: 'alert',
      targetId: alertId,
      metadata:
        dto.status === 'dismissed'
          ? { dismissalReason: dto.dismissalReason }
          : undefined,
    });

    const entityDisplayById = await this.resolveEntityDisplays([updated]);
    const updatedDto = {
      ...toStudentAlertDto(updated),
      entityDisplay: entityDisplayById.get(updated.primaryEntityId) ?? null,
    };
    await this.realtimeEvents.publish(sessionId, {
      type: 'alert.updated',
      payload: updatedDto,
    });
    return updatedDto;
  }
}
