import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  summariseAction,
  summariseActivity,
  type ActivityEntry,
} from './activity-log';
import type { InvestigationActionType, Prisma } from '@prisma/client';

// §6.13: the audit/replay trail of everything a Student does during a session. Every
// domain service that performs an investigative action calls this rather than writing
// the row itself, so the shape is consistent everywhere.
@Injectable()
export class InvestigationActionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The learner's own activity in a session — what they opened, pinned, searched and acted on.
   * Scoped to the requesting user, so this is genuinely "your activity" and never a window
   * onto anyone else's work.
   *
   * Labels are resolved in three batched queries rather than one per row: a thorough
   * investigation generates hundreds of actions, and N+1 here would be felt immediately.
   */
  async listForUser(sessionId: string, userId: string) {
    const actions = await this.prisma.investigationAction.findMany({
      where: { sessionId, userId },
      orderBy: { occurredAt: 'desc' },
    });

    const idsFor = (targetType: string) =>
      actions.filter((a) => a.targetType === targetType).map((a) => a.targetId);

    const [emails, identities, devices] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where: { id: { in: idsFor('email_message') } },
        select: { id: true, subject: true },
      }),
      this.prisma.identity.findMany({
        where: { id: { in: idsFor('identity') } },
        select: { id: true, displayName: true },
      }),
      this.prisma.device.findMany({
        where: { id: { in: idsFor('device') } },
        select: { id: true, hostname: true },
      }),
    ]);

    const labels = new Map<string, string>([
      ...emails.map((e) => [e.id, e.subject] as [string, string]),
      ...identities.map((i) => [i.id, i.displayName] as [string, string]),
      ...devices.map((d) => [d.id, d.hostname] as [string, string]),
    ]);

    const entries: ActivityEntry[] = actions.map((a) => {
      const targetLabel = labels.get(a.targetId) ?? null;
      return {
        id: a.id,
        actionType: a.actionType,
        targetType: a.targetType,
        targetId: a.targetId,
        targetLabel,
        occurredAt: a.occurredAt,
        summary: summariseAction(a.actionType, a.targetType, targetLabel),
      };
    });

    return { entries, summary: summariseActivity(actions) };
  }

  async record(params: {
    sessionId: string;
    incidentId?: string | null;
    userId: string;
    actionType: InvestigationActionType;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.investigationAction.create({
      data: {
        sessionId: params.sessionId,
        incidentId: params.incidentId ?? null,
        userId: params.userId,
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata,
      },
    });
  }
}
