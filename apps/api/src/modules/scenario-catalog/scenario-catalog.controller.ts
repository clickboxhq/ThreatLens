import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppException } from '../../common/exceptions/app-exception';
import type { ScenarioCategory, ScenarioDifficulty } from '@prisma/client';

// §16.3 — never includes ground_truth_definition or internal version metadata (§12.3).
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
      // The MITRE techniques this scenario's kill chain actually exercises — lets the
      // frontend recommend scenarios by weak tactic without a second round-trip per scenario.
      techniqueIds:
        s.currentVersion?.techniques.map(
          (st) => st.mitreTechnique.techniqueId,
        ) ?? [],
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
      techniqueIds:
        scenario.currentVersion?.techniques.map(
          (st) => st.mitreTechnique.techniqueId,
        ) ?? [],
    };
  }
}
