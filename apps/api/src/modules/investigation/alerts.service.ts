import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentAlertDto } from '../../common/dto/alert.dto';
import { toStudentEmailDto } from '../../common/dto/email.dto';
import { toStudentSignInDto } from '../../common/dto/sign-in.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { UpdateAlertStatusDto } from './dto/dismiss-alert.dto';
import type { AlertSeverity, AlertStatus, Prisma } from '@prisma/client';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(sessionId: string, user: AuthenticatedUser, filters: { severity?: AlertSeverity; status?: AlertStatus }) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const where: Prisma.AlertWhereInput = { sessionId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const alerts = await this.prisma.alert.findMany({
      where,
      include: { mitreTechnique: true },
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
    });
    return alerts.map(toStudentAlertDto);
  }

  async getEvidence(sessionId: string, alertId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const alert = await this.prisma.alert.findFirst({ where: { id: alertId, sessionId }, include: { evidenceRefs: true } });
    if (!alert) throw new AppException(404, 'NOT_FOUND', 'Alert not found.');

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'alert',
      targetId: alertId,
    });

    const evidence = await Promise.all(
      alert.evidenceRefs.map(async (ref) => {
        if (ref.eventTable === 'email_messages') {
          const email = await this.prisma.emailMessage.findUnique({
            where: { id: ref.eventId },
            include: { attachments: true, urls: true },
          });
          return {
            eventTable: ref.eventTable,
            eventId: ref.eventId,
            occurredAt: email?.occurredAt,
            summary: email ? `Email from "${email.senderAddress}": "${email.subject}"` : 'Event no longer available.',
            detail: email ? toStudentEmailDto(email) : null,
          };
        }
        if (ref.eventTable === 'sign_in_events') {
          const event = await this.prisma.signInEvent.findUnique({ where: { id: ref.eventId } });
          return {
            eventTable: ref.eventTable,
            eventId: ref.eventId,
            occurredAt: event?.occurredAt,
            summary: event ? `Sign-in from ${event.sourceCity}, ${event.sourceCountry} to "${event.application}"` : 'Event no longer available.',
            detail: event ? toStudentSignInDto(event) : null,
          };
        }
        return { eventTable: ref.eventTable, eventId: ref.eventId, summary: 'Unknown event type.', detail: null };
      }),
    );

    return { alertId, evidence };
  }

  async updateStatus(sessionId: string, alertId: string, user: AuthenticatedUser, dto: UpdateAlertStatusDto) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const alert = await this.prisma.alert.findFirst({ where: { id: alertId, sessionId } });
    if (!alert) throw new AppException(404, 'NOT_FOUND', 'Alert not found.');

    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        status: dto.status,
        dismissalReason: dto.status === 'dismissed' ? dto.dismissalReason : alert.dismissalReason,
      },
      include: { mitreTechnique: true },
    });

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: dto.status === 'dismissed' ? 'dismiss_alert' : 'view_entity',
      targetType: 'alert',
      targetId: alertId,
      metadata: dto.status === 'dismissed' ? { dismissalReason: dto.dismissalReason } : undefined,
    });

    return toStudentAlertDto(updated);
  }
}
