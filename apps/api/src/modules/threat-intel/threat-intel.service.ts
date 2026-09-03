import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { IndicatorType } from '@prisma/client';

// §16.12 / §2.7 — scenario-scoped threat intel lookup, never a live external call (§1.6).
// Deliberately a *lookup*, not a browsable list: GET /sessions/:id/threat-intel only ever
// answers a specific (type, value) query the Student already has from the generated
// telemetry, so there is no endpoint that could hand back a scenario's full indicator set
// (its ground truth) in one call.
@Injectable()
export class ThreatIntelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async lookup(
    sessionId: string,
    user: AuthenticatedUser,
    type: IndicatorType,
    value: string,
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    const indicator = await this.prisma.threatIntelIndicator.findFirst({
      where: {
        scenarioVersionId: session.scenarioVersionId,
        indicatorType: type,
        value,
      },
    });
    if (!indicator) {
      return {
        value,
        type,
        reputation: 'unknown',
        actorAttribution: null,
        context: null,
      };
    }

    // Only a real match gets recorded — an "unknown" result has no real indicator row to
    // point InvestigationAction.targetId (a UUID FK) at, and recording misses would also let
    // a Student build up a list of "things that aren't in this scenario" for free, which is
    // itself a (weaker) ground-truth signal worth not handing out.
    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_threat_intel',
      targetType: 'threat_intel_indicator',
      targetId: indicator.id,
    });

    return {
      value: indicator.value,
      type: indicator.indicatorType,
      reputation: indicator.reputation,
      actorAttribution: indicator.actorAttribution,
      context: indicator.context,
    };
  }

  // §2.7 "Threat Intelligence" history — every indicator lookup that actually matched
  // something, across every session the Student has ever run, newest first. Re-reads the
  // indicator row at display time (rather than snapshotting it onto the action row) so a
  // correction to a scenario's ground truth is reflected retroactively.
  async listMine(user: AuthenticatedUser) {
    const actions = await this.prisma.investigationAction.findMany({
      where: { userId: user.id, actionType: 'view_threat_intel' },
      include: {
        session: { include: { scenario: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
    if (actions.length === 0) return { indicators: [], actors: [] };

    const indicatorIds = [...new Set(actions.map((a) => a.targetId))];
    const indicators = await this.prisma.threatIntelIndicator.findMany({
      where: { id: { in: indicatorIds } },
    });
    const indicatorById = new Map(indicators.map((i) => [i.id, i]));

    const indicatorRows = actions
      .map((action) => {
        const indicator = indicatorById.get(action.targetId);
        if (!indicator) return null;
        return {
          id: action.id,
          value: indicator.value,
          type: indicator.indicatorType,
          reputation: indicator.reputation,
          actorAttribution: indicator.actorAttribution,
          context: indicator.context,
          scenarioTitle: action.session.scenario.title,
          lookedUpAt: action.occurredAt,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Grouped by the attributed actor across every indicator the Student has personally
    // looked up and found — "campaigns" is the count of distinct scenarios that actor showed
    // up in for this Student, not a global campaign registry (ThreatLens has no such entity).
    const byActor = new Map<
      string,
      {
        indicatorCount: number;
        scenarioTitles: Set<string>;
        worstReputation: string;
      }
    >();
    const reputationRank: Record<string, number> = {
      unknown: 0,
      known_good: 1,
      suspicious: 2,
      malicious: 3,
    };
    for (const row of indicatorRows) {
      if (!row.actorAttribution) continue;
      const entry = byActor.get(row.actorAttribution) ?? {
        indicatorCount: 0,
        scenarioTitles: new Set<string>(),
        worstReputation: 'unknown',
      };
      entry.indicatorCount += 1;
      entry.scenarioTitles.add(row.scenarioTitle);
      if (
        (reputationRank[row.reputation] ?? 0) >
        (reputationRank[entry.worstReputation] ?? 0)
      ) {
        entry.worstReputation = row.reputation;
      }
      byActor.set(row.actorAttribution, entry);
    }

    return {
      indicators: indicatorRows,
      actors: [...byActor.entries()].map(([name, entry]) => ({
        name,
        indicatorCount: entry.indicatorCount,
        campaigns: entry.scenarioTitles.size,
        reputation: entry.worstReputation,
      })),
    };
  }
}
