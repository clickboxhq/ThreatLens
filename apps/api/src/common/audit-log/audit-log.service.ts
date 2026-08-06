import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

// §6.22 / §15.9: platform-wide, security/compliance-relevant action log. Every domain
// service that performs a security- or grading-relevant mutation calls this rather than
// writing the row itself, so the shape is consistent everywhere (mirrors the
// InvestigationActionsService pattern for the session-scoped equivalent, §6.13).
//
// Rows here are INSERT-only by policy — the migration that created this table revokes
// UPDATE/DELETE from the application's DB role, so `.update()`/`.delete()` would fail at the
// database layer even if called; this service simply never exposes those operations.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorUserId?: string | null;
    actorIp?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Prisma.InputJsonValue;
    correlationId?: string | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        actorIp: params.actorIp ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: params.metadata,
        correlationId: params.correlationId ?? null,
      },
    });
  }
}
