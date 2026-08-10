import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

interface AuthoredHint {
  unlock_cost_percent: number;
  text: string;
}

// §12.5: hints are always available, never count-limited — requesting one costs score,
// not access. A hint is only ever unlocked once per session (idempotent), since re-clicking
// an already-unlocked hint must not charge the penalty twice.
@Injectable()
export class HintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(sessionId: string, user: AuthenticatedUser) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const hints = await this.getAuthoredHints(session.scenarioVersionId);
    const unlocks = await this.prisma.hintUnlock.findMany({
      where: { sessionId },
    });
    const unlockedIndexes = new Set(unlocks.map((u) => u.hintIndex));

    return hints.map((hint, index) => ({
      index,
      unlockCostPercent: hint.unlock_cost_percent,
      unlocked: unlockedIndexes.has(index),
      text: unlockedIndexes.has(index) ? hint.text : null,
    }));
  }

  async unlock(sessionId: string, index: number, user: AuthenticatedUser) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const hints = await this.getAuthoredHints(session.scenarioVersionId);
    const hint = hints[index];
    if (!hint) {
      throw new AppException(
        404,
        'HINT_NOT_FOUND',
        'No hint exists at this index for this scenario.',
      );
    }

    const existing = await this.prisma.hintUnlock.findUnique({
      where: { sessionId_hintIndex: { sessionId, hintIndex: index } },
    });

    if (!existing) {
      const unlock = await this.prisma.hintUnlock.create({
        data: {
          sessionId,
          hintIndex: index,
          unlockCostPercent: hint.unlock_cost_percent,
        },
      });
      await this.investigationActions.record({
        sessionId,
        userId: user.id,
        actionType: 'request_hint',
        targetType: 'hint',
        targetId: unlock.id,
        metadata: {
          hintIndex: index,
          unlockCostPercent: hint.unlock_cost_percent,
        },
      });
    }

    return this.list(sessionId, user);
  }

  private async getAuthoredHints(
    scenarioVersionId: string,
  ): Promise<AuthoredHint[]> {
    const version = await this.prisma.scenarioVersion.findUniqueOrThrow({
      where: { id: scenarioVersionId },
    });
    const def = version.groundTruthDefinition as unknown as {
      hints?: AuthoredHint[];
    };
    return def.hints ?? [];
  }
}
