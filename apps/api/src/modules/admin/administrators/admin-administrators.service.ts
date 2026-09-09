import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException } from '../../../common/exceptions/app-exception';
import { AuditLogService } from '../../../common/audit-log/audit-log.service';
import { ADMIN_AUDIT } from '../admin-audit';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

// Platform administrators. RBAC here is the existing UserRole enum — `platform_admin` is the
// single platform-level role, and it is deliberately not self-serve (see prisma/grant-admin
// .ts). This surface lets an existing platform admin promote another *verified, active*
// account and demote one, both audited, with the guard rails the CLI has: no self-demotion,
// never remove the last admin.
@Injectable()
export class AdminAdministratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list() {
    const admins = await this.prisma.user.findMany({
      where: { role: 'platform_admin', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    // "Last activity" = the most recent audit_logs row where they were the actor.
    const lastActionByActor = new Map<string, Date>();
    if (admins.length) {
      const rows = await this.prisma.auditLog.groupBy({
        by: ['actorUserId'],
        where: { actorUserId: { in: admins.map((a) => a.id) } },
        _max: { occurredAt: true },
      });
      for (const r of rows) {
        if (r.actorUserId && r._max.occurredAt) {
          lastActionByActor.set(r.actorUserId, r._max.occurredAt);
        }
      }
    }

    return admins.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      email: a.email,
      role: 'platform_admin' as const,
      status: a.status,
      mfaEnabled: a.mfaEnabled,
      lastActivityAt:
        lastActionByActor.get(a.id)?.toISOString() ??
        a.lastLoginAt?.toISOString() ??
        null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async grant(admin: AuthenticatedUser, email: string, actorIp?: string) {
    const target = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        role: true,
        status: true,
        passwordHash: true,
        emailVerifiedAt: true,
      },
    });
    if (!target) {
      throw new AppException(
        404,
        'NO_ACCOUNT',
        'No account exists for that email address. They must sign up first.',
      );
    }
    if (!target.passwordHash || !target.emailVerifiedAt) {
      throw new AppException(
        409,
        'ACCOUNT_NOT_READY',
        'The account must have a password set and a verified email address.',
      );
    }
    if (target.status !== 'active') {
      throw new AppException(
        409,
        'ACCOUNT_NOT_ACTIVE',
        `The account is ${target.status}, not active.`,
      );
    }
    if (target.role === 'platform_admin') {
      return { id: target.id, role: 'platform_admin' as const, changed: false };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: target.id },
        data: { role: 'platform_admin', sessionVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action: ADMIN_AUDIT.adminRoleGranted,
      targetType: 'user',
      targetId: target.id,
      metadata: { email, previousRole: target.role, via: 'admin_ui' },
    });
    return { id: target.id, role: 'platform_admin' as const, changed: true };
  }

  async revoke(admin: AuthenticatedUser, userId: string, actorIp?: string) {
    if (userId === admin.id) {
      throw new AppException(
        400,
        'CANNOT_DEMOTE_SELF',
        'You cannot remove your own platform-admin role.',
      );
    }
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!target || target.role !== 'platform_admin') {
      throw new AppException(
        404,
        'NOT_AN_ADMIN',
        'That account is not a platform administrator.',
      );
    }
    const adminCount = await this.prisma.user.count({
      where: { role: 'platform_admin', deletedAt: null },
    });
    if (adminCount <= 1) {
      throw new AppException(
        409,
        'LAST_ADMIN',
        'This is the only platform administrator — promote another account first.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { role: 'student', sessionVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action: ADMIN_AUDIT.adminRoleRevoked,
      targetType: 'user',
      targetId: userId,
      metadata: { newRole: 'student' },
    });
    return { id: userId, role: 'student' as const };
  }
}
