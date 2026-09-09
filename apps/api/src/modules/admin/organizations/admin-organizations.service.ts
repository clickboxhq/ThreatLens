import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException } from '../../../common/exceptions/app-exception';
import { AuditLogService } from '../../../common/audit-log/audit-log.service';
import { ADMIN_AUDIT } from '../admin-audit';
import {
  toPage,
  type Page,
  type PaginationQuery,
} from '../dto/pagination.query';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

export interface AdminOrgRow {
  id: string;
  name: string;
  industry: string | null;
  status: string;
  memberCount: number;
  adminCount: number;
  // No billing yet.
  plan: string | null;
  activeSeats: number | null;
  createdAt: string;
}

@Injectable()
export class AdminOrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    query: PaginationQuery & { status?: string },
  ): Promise<Page<AdminOrgRow>> {
    const where: Prisma.OrganizationWhereInput = {};
    if (query.status === 'active' || query.status === 'suspended') {
      where.status = query.status;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          name: true,
          industry: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true } },
          users: { where: { role: 'org_admin' }, select: { id: true } },
        },
      }),
    ]);

    return toPage(
      orgs.map((o) => ({
        id: o.id,
        name: o.name,
        industry: o.industry,
        status: o.status,
        memberCount: o._count.users,
        adminCount: o.users.length,
        plan: null,
        activeSeats: null,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  async getDetail(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        industry: true,
        teamSize: true,
        status: true,
        suspendedAt: true,
        createdAt: true,
        users: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        cohorts: {
          select: { id: true, name: true, archivedAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!org)
      throw new AppException(404, 'NOT_FOUND', 'Organization not found.');

    const memberIds = org.users.map((u) => u.id);
    const [scoredCount, recentActivity] = await Promise.all([
      memberIds.length
        ? this.prisma.investigationSession.count({
            where: { userId: { in: memberIds }, status: 'scored' },
          })
        : 0,
      this.prisma.auditLog.findMany({
        where: { targetType: 'organization', targetId: orgId },
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
      id: org.id,
      name: org.name,
      industry: org.industry,
      teamSize: org.teamSize,
      status: org.status,
      suspendedAt: org.suspendedAt?.toISOString() ?? null,
      createdAt: org.createdAt.toISOString(),
      members: org.users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      cohorts: org.cohorts.map((c) => ({
        id: c.id,
        name: c.name,
        archived: c.archivedAt !== null,
      })),
      usage: {
        activeCohorts: org.cohorts.filter((c) => !c.archivedAt).length,
        investigationsCompleted: scoredCount,
      },
      recentActivity: recentActivity.map((a) => ({
        action: a.action,
        occurredAt: a.occurredAt.toISOString(),
        metadata: a.metadata,
      })),
    };
  }

  async setStatus(
    admin: AuthenticatedUser,
    orgId: string,
    status: 'active' | 'suspended',
    actorIp?: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, status: true },
    });
    if (!org)
      throw new AppException(404, 'NOT_FOUND', 'Organization not found.');
    if (org.status === status) return { id: orgId, status };

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        status,
        suspendedAt: status === 'suspended' ? new Date() : null,
      },
    });

    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action:
        status === 'suspended'
          ? ADMIN_AUDIT.orgSuspended
          : ADMIN_AUDIT.orgReactivated,
      targetType: 'organization',
      targetId: orgId,
      metadata: { previousStatus: org.status },
    });

    return { id: orgId, status };
  }
}
