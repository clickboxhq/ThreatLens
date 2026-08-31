import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException } from '../../common/exceptions/app-exception';
import { computeSkillRadar } from '../sessions/skill-radar';
import type { SessionTechniqueOutcome } from '../sessions/skill-radar';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { ScenarioCategory, ScenarioDifficulty } from '@prisma/client';

// §16.3 — never includes ground_truth_definition or internal version metadata (§12.3).
//
// It must also never include the scenario's MITRE technique list. ScenarioTechnique is
// populated directly from scoring_rubric.required_techniques, so that list IS the answer key
// for the technique-accuracy component — 30% of the grade. Exposing it here briefly let any
// authenticated student read the answer straight off the catalog before opening a session,
// and learn the shape of the attack narrative besides.
//
// Weak-tactic recommendation is what needed it. That now lives on GET /scenarios/recommended,
// which does the matching server-side and returns a scenario plus the tactic being worked on —
// never the technique list that would give the answer away.
@Controller('scenarios')
@UseGuards(JwtAuthGuard)
export class ScenarioCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('category') category?: ScenarioCategory,
    @Query('difficulty') difficulty?: ScenarioDifficulty,
  ) {
    const scenarios = await this.prisma.attackScenario.findMany({
      where: { status: 'published', category, difficulty },
      orderBy: { title: 'asc' },
    });
    return scenarios.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      category: s.category,
      difficulty: s.difficulty,
      estimatedMinutes: s.estimatedMinutes,
    }));
  }

  /**
   * The scenario that best exercises the tactic the learner is weakest on.
   *
   * Declared before :slug — Nest matches in declaration order and the param route would
   * otherwise swallow "recommended".
   *
   * The matching happens here rather than in the browser precisely so the technique lists it
   * reads never leave the server. The response names the tactic (a coarse ATT&CK grouping,
   * which is the *reason* for the recommendation and useful to a learner) but not the
   * techniques, which would be the answer.
   */
  @Get('recommended')
  async getRecommended(@CurrentUser() user: AuthenticatedUser) {
    const scoredSessions = await this.prisma.investigationSession.findMany({
      where: { userId: user.id, status: 'scored' },
      include: { scenarioVersion: true },
    });
    if (scoredSessions.length === 0) return null;

    const sessionIds = scoredSessions.map((s) => s.id);
    const closedIncidents = await this.prisma.incident.findMany({
      where: { sessionId: { in: sessionIds }, status: 'closed' },
      include: { techniqueLinks: { include: { mitreTechnique: true } } },
    });

    const taggedBySession = new Map<string, Set<string>>();
    for (const incident of closedIncidents) {
      const set = taggedBySession.get(incident.sessionId) ?? new Set<string>();
      for (const link of incident.techniqueLinks) {
        set.add(link.mitreTechnique.techniqueId);
      }
      taggedBySession.set(incident.sessionId, set);
    }

    const outcomes: SessionTechniqueOutcome[] = scoredSessions.map((s) => {
      const def = s.scenarioVersion.groundTruthDefinition as unknown as {
        scoring_rubric: { required_techniques: string[] };
      };
      return {
        requiredTechniqueIds: def.scoring_rubric.required_techniques,
        taggedTechniqueIds: [...(taggedBySession.get(s.id) ?? [])],
      };
    });

    const allTechniques = await this.prisma.mitreTechnique.findMany({
      select: { techniqueId: true, tactic: true },
    });
    const tacticByTechniqueId = new Map(
      allTechniques.map((t) => [t.techniqueId, t.tactic]),
    );

    const radar = computeSkillRadar(outcomes, tacticByTechniqueId);
    if (radar.length === 0) return null;
    const weakest = [...radar].sort((a, b) => a.percent - b.percent)[0];

    // Scenarios the learner has not already scored, ranked by how much of the weak tactic
    // they cover. This read touches required_techniques, which is exactly why it belongs
    // on the server.
    const attemptedIds = new Set(scoredSessions.map((s) => s.scenarioId));
    const candidates = await this.prisma.attackScenario.findMany({
      where: { status: 'published' },
      include: {
        currentVersion: {
          include: { techniques: { include: { mitreTechnique: true } } },
        },
      },
    });

    let best: (typeof candidates)[number] | null = null;
    let bestOverlap = 0;
    for (const scenario of candidates) {
      if (attemptedIds.has(scenario.id)) continue;
      const overlap =
        scenario.currentVersion?.techniques.filter(
          (t) => t.mitreTechnique.tactic === weakest.tactic,
        ).length ?? 0;
      if (overlap > bestOverlap) {
        best = scenario;
        bestOverlap = overlap;
      }
    }
    if (!best) return null;

    return {
      scenarioId: best.id,
      scenarioSlug: best.slug,
      scenarioTitle: best.title,
      tactic: weakest.tactic,
      tacticName: weakest.tacticName,
      percent: weakest.percent,
      hitCount: weakest.hitCount,
      requiredCount: weakest.requiredCount,
    };
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const scenario = await this.prisma.attackScenario.findUnique({
      where: { slug },
    });
    if (!scenario || scenario.status !== 'published') {
      throw new AppException(404, 'NOT_FOUND', 'Scenario not found.');
    }
    return {
      id: scenario.id,
      slug: scenario.slug,
      title: scenario.title,
      summary: scenario.summary,
      category: scenario.category,
      difficulty: scenario.difficulty,
      estimatedMinutes: scenario.estimatedMinutes,
    };
  }
}
