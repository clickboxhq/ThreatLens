import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppException } from '../../common/exceptions/app-exception';
import type { ScenarioCategory, ScenarioDifficulty } from '@prisma/client';

// §16.3 — never includes ground_truth_definition or internal version metadata (§12.3).
//
// SECURITY: this controller must never expose exact MITRE technique IDs for a scenario.
// `ScenarioTechnique` rows are populated directly from `groundTruthDefinition
// .scoring_rubric.required_techniques` (see scenario-builder.service.ts) with no decoy
// techniques mixed in — so a per-technique list here IS the scoring answer key for the
// 30%-weighted technique-accuracy rubric component, readable before a student even starts
// a session. Only the broader tactic-level coverage (which tactics this scenario touches,
// and how many techniques each covers) is safe to return: still useful for "recommend a
// scenario for my weakest tactic," but nowhere near specific enough to game the rubric.
function tacticCoverage(
  techniques: { mitreTechnique: { tactic: string } }[] | undefined,
): { tactic: string; techniqueCount: number }[] {
  const counts = new Map<string, number>();
  for (const t of techniques ?? []) {
    const tactic = t.mitreTechnique.tactic;
    counts.set(tactic, (counts.get(tactic) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tactic, techniqueCount]) => ({
    tactic,
    techniqueCount,
  }));
}

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
      include: {
        currentVersion: {
          include: { techniques: { include: { mitreTechnique: true } } },
        },
      },
    });
    return scenarios.map((s) => ({
      id: s.id,
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      category: s.category,
      difficulty: s.difficulty,
      estimatedMinutes: s.estimatedMinutes,
      tacticCoverage: tacticCoverage(s.currentVersion?.techniques),
    }));
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const scenario = await this.prisma.attackScenario.findUnique({
      where: { slug },
      include: {
        currentVersion: {
          include: { techniques: { include: { mitreTechnique: true } } },
        },
      },
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
      tacticCoverage: tacticCoverage(scenario.currentVersion?.techniques),
    };
  }
}
