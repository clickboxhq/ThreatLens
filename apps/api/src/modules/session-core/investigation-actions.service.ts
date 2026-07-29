import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { InvestigationActionType, Prisma } from '@prisma/client';

// §6.13: the audit/replay trail of everything a Student does during a session. Every
// domain service that performs an investigative action calls this rather than writing
// the row itself, so the shape is consistent everywhere.
@Injectable()
export class InvestigationActionsService {
  constructor(private readonly prisma: PrismaService) {}

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
