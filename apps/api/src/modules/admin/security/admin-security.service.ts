import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SECURITY_AUDIT_ACTIONS } from '../admin-audit';
import { toPage, type Page } from '../dto/pagination.query';

// Security Events reads back the auth-surface events the auth service already records into
// audit_logs (login_failed, account_locked, mfa_*) plus the admin actions that matter for
// security review. No new table — those events are already captured; this is the view.
@Injectable()
export class AdminSecurityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = Date.now();
    const day = new Date(now - 24 * 60 * 60 * 1000);
    const week = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const securityWhere: Prisma.AuditLogWhereInput = {
      action: { in: [...SECURITY_AUDIT_ACTIONS] },
    };

    const [
      mfaEnabled,
      mfaDisabled,
      adminsWithoutMfa,
      failedLoginsDay,
      failedLoginsWeek,
      lockoutsWeek,
      failedMfaWeek,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null, mfaEnabled: true } }),
      this.prisma.user.count({ where: { deletedAt: null, mfaEnabled: false } }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          mfaEnabled: false,
          role: { in: ['platform_admin', 'org_admin', 'instructor'] },
        },
      }),
      this.prisma.auditLog.count({
        where: { action: 'login_failed', occurredAt: { gte: day } },
      }),
      this.prisma.auditLog.count({
        where: { action: 'login_failed', occurredAt: { gte: week } },
      }),
      this.prisma.auditLog.count({
        where: { action: 'account_locked', occurredAt: { gte: week } },
      }),
      this.prisma.auditLog.count({
        where: { action: 'mfa_challenge_failed', occurredAt: { gte: week } },
      }),
      this.prisma.auditLog.findMany({
        where: securityWhere,
        orderBy: { occurredAt: 'desc' },
        take: 20,
        include: { actor: { select: { displayName: true, email: true } } },
      }),
    ]);

    return {
      mfa: {
        enabled: mfaEnabled,
        disabled: mfaDisabled,
        adoptionPercent:
          mfaEnabled + mfaDisabled > 0
            ? Math.round((mfaEnabled / (mfaEnabled + mfaDisabled)) * 1000) / 10
            : null,
        privilegedWithoutMfa: adminsWithoutMfa,
      },
      failedLogins: { last24h: failedLoginsDay, last7d: failedLoginsWeek },
      lockouts: { last7d: lockoutsWeek },
      failedMfaChallenges: { last7d: failedMfaWeek },
      recentEvents: recent.map((e) => this.toEvent(e)),
      generatedAt: new Date().toISOString(),
    };
  }

  async listEvents(query: {
    page: number;
    limit: number;
    action?: string;
    from?: string;
    to?: string;
  }): Promise<Page<ReturnType<AdminSecurityService['toEvent']>>> {
    const where: Prisma.AuditLogWhereInput = {
      action: query.action ? query.action : { in: [...SECURITY_AUDIT_ACTIONS] },
    };
    if (query.from || query.to) {
      where.occurredAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [total, events] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { actor: { select: { displayName: true, email: true } } },
      }),
    ]);

    return toPage(
      events.map((e) => this.toEvent(e)),
      total,
      query,
    );
  }

  private toEvent(e: {
    id: string;
    action: string;
    actorUserId: string | null;
    actorIp: string | null;
    targetType: string | null;
    targetId: string | null;
    metadata: Prisma.JsonValue;
    occurredAt: Date;
    actor: { displayName: string; email: string } | null;
  }) {
    return {
      id: e.id,
      action: e.action,
      actor: e.actor
        ? { displayName: e.actor.displayName, email: e.actor.email }
        : null,
      actorIp: e.actorIp,
      targetType: e.targetType,
      targetId: e.targetId,
      metadata: e.metadata,
      occurredAt: e.occurredAt.toISOString(),
    };
  }
}
