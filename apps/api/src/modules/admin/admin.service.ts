import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import type { AuditLogQueryDto } from './dto/audit-log-query.dto';

const AUDIT_LOG_PAGE_SIZE = 100;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // §16.14 / §6.22 — filtered read over the append-only audit_logs table.
  async listAuditLogs(query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.action) where.action = query.action;
    if (query.from || query.to) {
      where.occurredAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { occurredAt: 'desc' },
      take: AUDIT_LOG_PAGE_SIZE,
    });

    return logs.map((l) => ({
      id: l.id,
      actorUserId: l.actorUserId,
      actorDisplayName: l.actor?.displayName ?? null,
      actorIp: l.actorIp,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      metadata: l.metadata,
      correlationId: l.correlationId,
      occurredAt: l.occurredAt,
    }));
  }
}
