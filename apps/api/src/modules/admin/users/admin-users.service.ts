import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException } from '../../../common/exceptions/app-exception';
import { AuditLogService } from '../../../common/audit-log/audit-log.service';
import { toNumber } from '../../../common/dto/decimal';
import { ADMIN_AUDIT } from '../admin-audit';
import { toPage, type Page } from '../dto/pagination.query';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';
import type { ListUsersQuery } from './list-users.query';

export interface AdminUserRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  organization: { id: string; name: string } | null;
  // No billing yet — always null. Kept on the row so the Users table has the column the
  // brief asks for and it fills in for free once subscriptions exist.
  plan: string | null;
  mfaEnabled: boolean;
  emailVerified: boolean;
  joinedAt: string;
  lastActiveAt: string | null;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: ListUsersQuery): Promise<Page<AdminUserRow>> {
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.organizationId) where.orgId = query.organizationId;
    if (query.membership === 'individual') where.orgId = null;
    if (query.membership === 'organization') where.orgId = { not: null };
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sort === 'oldest'
        ? { createdAt: 'asc' }
        : query.sort === 'name'
          ? { displayName: 'asc' }
          : query.sort === 'lastActive'
            ? { lastLoginAt: { sort: 'desc', nulls: 'last' } }
            : { createdAt: 'desc' };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          status: true,
          mfaEnabled: true,
          emailVerifiedAt: true,
          createdAt: true,
          lastLoginAt: true,
          organization: { select: { id: true, name: true } },
        },
      }),
    ]);

    return toPage(
      users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        status: u.status,
        organization: u.organization,
        plan: null,
        mfaEnabled: u.mfaEnabled,
        emailVerified: u.emailVerifiedAt !== null,
        joinedAt: u.createdAt.toISOString(),
        lastActiveAt: u.lastLoginAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  }

  // The detail an admin needs to understand an account without opening a DB client. Selects
  // only non-sensitive columns — password hash, MFA secret and recovery-code hashes are
  // never in the select set, so they cannot leak.
  async getDetail(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        professionalRole: true,
        experienceLevel: true,
        mfaEnabled: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        organization: { select: { id: true, name: true, status: true } },
      },
    });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');

    const [scored, aggregate, certificateCount, recentActivity] =
      await Promise.all([
        this.prisma.investigationSession.count({
          where: { userId, status: 'scored' },
        }),
        this.prisma.score.aggregate({
          where: { session: { userId } },
          _avg: { overallPercent: true },
          _max: { overallPercent: true },
        }),
        this.prisma.certificate.count({ where: { userId, revokedAt: null } }),
        this.prisma.auditLog.findMany({
          where: { OR: [{ targetId: userId }, { actorUserId: userId }] },
          orderBy: { occurredAt: 'desc' },
          take: 15,
          select: {
            action: true,
            actorUserId: true,
            occurredAt: true,
            metadata: true,
          },
        }),
      ]);

    return {
      ...user,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      performance: {
        investigationsCompleted: scored,
        averageScore: toNumber(aggregate._avg.overallPercent),
        bestScore: toNumber(aggregate._max.overallPercent),
        certificates: certificateCount,
      },
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        bySelf: a.actorUserId === userId,
        occurredAt: a.occurredAt.toISOString(),
        metadata: a.metadata,
      })),
    };
  }

  async setStatus(
    admin: AuthenticatedUser,
    userId: string,
    status: 'active' | 'suspended',
    actorIp?: string,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, status: true, role: true },
    });
    if (!target) throw new AppException(404, 'NOT_FOUND', 'User not found.');
    if (target.id === admin.id) {
      throw new AppException(
        400,
        'CANNOT_SUSPEND_SELF',
        'You cannot change your own account status.',
      );
    }
    if (target.status === status) {
      return { id: userId, status };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status,
          // Kick every existing session immediately — jwt-auth.guard rejects a token whose
          // session_version is stale, and separately rejects a non-active account.
          sessionVersion: { increment: 1 },
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action:
        status === 'suspended'
          ? ADMIN_AUDIT.userSuspended
          : ADMIN_AUDIT.userReactivated,
      targetType: 'user',
      targetId: userId,
      metadata: { previousStatus: target.status },
    });

    return { id: userId, status };
  }

  // Clears MFA the same way the break-glass CLI (prisma/reset-mfa.ts) does — flips the flag,
  // nulls the secret, empties the recovery-code hashes, bumps the session version. It never
  // reads or returns the secret. The user re-enrols on next sign-in (privileged roles are
  // forced through enrolment; others can re-add it from settings).
  async resetMfa(admin: AuthenticatedUser, userId: string, actorIp?: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, mfaEnabled: true },
    });
    if (!target) throw new AppException(404, 'NOT_FOUND', 'User not found.');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodesHash: [],
          sessionVersion: { increment: 1 },
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action: ADMIN_AUDIT.userMfaReset,
      targetType: 'user',
      targetId: userId,
      metadata: { wasEnabled: target.mfaEnabled },
    });

    return { id: userId, mfaEnabled: false };
  }
}
