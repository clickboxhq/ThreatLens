import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeSkillRadar } from '../sessions/skill-radar';
import {
  computeProfilePerformance,
  type ProfilePerformanceResult,
  type ScoredSessionFact,
} from './profile-performance';
import type { SessionTechniqueOutcome } from '../sessions/skill-radar';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // §2.17/§13.2 — the caller's own investigation performance, aggregated server-side. Scoped
  // to `userId` on every query, and there is no route parameter naming another user, so this
  // cannot be pointed at someone else's record (the IDOR check the brief asks for is
  // structural here, not a comparison). Returns a valid, fully-zeroed result for a user who
  // has never completed an investigation.
  async getPerformance(
    userId: string,
  ): Promise<ProfilePerformanceResult & { generatedAt: string }> {
    const [scoredSessions, abandonedCount] = await Promise.all([
      this.prisma.investigationSession.findMany({
        where: { userId, status: 'scored' },
        select: {
          id: true,
          scenarioId: true,
          scenario: {
            select: { title: true, category: true, difficulty: true },
          },
          scenarioVersion: { select: { groundTruthDefinition: true } },
          score: {
            select: {
              overallPercent: true,
              evidencePrecisionPercent: true,
              evidenceRecallPercent: true,
              techniqueAccuracyPercent: true,
              verdictCorrect: true,
              falsePositiveCount: true,
              timeToResolutionSeconds: true,
              scoredAt: true,
            },
          },
        },
      }),
      this.prisma.investigationSession.count({
        where: { userId, status: 'abandoned' },
      }),
    ]);

    // A scored session always has a Score row (the scoring worker writes both in the same
    // step), but the relation is nullable in the schema, so filter defensively.
    const withScore = scoredSessions.filter(
      (s): s is typeof s & { score: NonNullable<(typeof s)['score']> } =>
        s.score !== null,
    );

    const scored: ScoredSessionFact[] = withScore.map((s) => ({
      sessionId: s.id,
      scenarioId: s.scenarioId,
      scenarioTitle: s.scenario.title,
      scenarioCategory: s.scenario.category,
      difficulty: s.scenario.difficulty,
      overallPercent: Number(s.score.overallPercent),
      evidencePrecisionPercent: Number(s.score.evidencePrecisionPercent),
      evidenceRecallPercent: Number(s.score.evidenceRecallPercent),
      techniqueAccuracyPercent: Number(s.score.techniqueAccuracyPercent),
      verdictCorrect: s.score.verdictCorrect,
      falsePositiveCount: s.score.falsePositiveCount,
      timeToResolutionSeconds: s.score.timeToResolutionSeconds,
      scoredAt: s.score.scoredAt.toISOString(),
    }));

    const mitreTacticsCovered = await this.countTacticsCovered(withScore);

    const result = computeProfilePerformance({
      scored,
      abandonedCount,
      mitreTacticsCovered,
    });

    return { ...result, generatedAt: new Date().toISOString() };
  }

  // How many distinct MITRE tactics the user has faced at least one required technique for,
  // across every scored session. Re-derives required-vs-tagged the same way
  // sessions.service.ts's skill radar does (rubric technique list + closed-incident technique
  // links) and reuses the same pure helper — only the tactic *count* is returned to the
  // caller, never the technique lists themselves.
  private async countTacticsCovered(
    sessions: {
      id: string;
      scenarioVersion: { groundTruthDefinition: unknown } | null;
    }[],
  ): Promise<number> {
    if (sessions.length === 0) return 0;

    const sessionIds = sessions.map((s) => s.id);
    const closedIncidents = await this.prisma.incident.findMany({
      where: { sessionId: { in: sessionIds }, status: 'closed' },
      include: { techniqueLinks: { include: { mitreTechnique: true } } },
    });

    const taggedBySessionId = new Map<string, Set<string>>();
    for (const incident of closedIncidents) {
      const set =
        taggedBySessionId.get(incident.sessionId) ?? new Set<string>();
      for (const link of incident.techniqueLinks) {
        set.add(link.mitreTechnique.techniqueId);
      }
      taggedBySessionId.set(incident.sessionId, set);
    }

    const outcomes: SessionTechniqueOutcome[] = sessions.map((session) => {
      const def = (session.scenarioVersion?.groundTruthDefinition ?? {
        scoring_rubric: { required_techniques: [] },
      }) as {
        scoring_rubric?: { required_techniques?: string[] };
      };
      return {
        requiredTechniqueIds: def.scoring_rubric?.required_techniques ?? [],
        taggedTechniqueIds: [...(taggedBySessionId.get(session.id) ?? [])],
      };
    });

    const allTechniques = await this.prisma.mitreTechnique.findMany({
      select: { techniqueId: true, tactic: true },
    });
    const tacticByTechniqueId = new Map(
      allTechniques.map((t) => [t.techniqueId, t.tactic]),
    );

    return computeSkillRadar(outcomes, tacticByTechniqueId).length;
  }
}
