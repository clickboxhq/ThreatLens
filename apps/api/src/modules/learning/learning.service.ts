import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourses() {
    const courses = await this.prisma.course.findMany({
      include: {
        learningPaths: { include: { _count: { select: { scenarios: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      careerTrack: c.careerTrack,
      paths: c.learningPaths.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        scenarioCount: p._count.scenarios,
      })),
    }));
  }

  // §13.2: progress is a derived view over investigation_sessions + scores, computed on
  // read — no separate progress-state table to keep in sync.
  async getPath(pathId: string, user: AuthenticatedUser) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: {
        course: true,
        scenarios: {
          include: { scenario: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!path)
      throw new AppException(404, 'NOT_FOUND', 'Learning path not found.');

    const scenarioIds = path.scenarios.map((s) => s.scenarioId);
    const sessions = await this.prisma.investigationSession.findMany({
      where: {
        userId: user.id,
        scenarioId: { in: scenarioIds },
        status: 'scored',
      },
      include: { score: true },
    });

    const bestPercentByScenario = new Map<string, number>();
    for (const session of sessions) {
      if (!session.score) continue;
      const percent = Number(session.score.overallPercent);
      const best = bestPercentByScenario.get(session.scenarioId) ?? -1;
      if (percent > best)
        bestPercentByScenario.set(session.scenarioId, percent);
    }

    const threshold = Number(path.passThresholdPercent);
    const scenarios = path.scenarios.map((entry) => {
      const bestPercent = bestPercentByScenario.get(entry.scenarioId) ?? null;
      return {
        scenarioId: entry.scenarioId,
        sortOrder: entry.sortOrder,
        title: entry.scenario.title,
        category: entry.scenario.category,
        difficulty: entry.scenario.difficulty,
        estimatedMinutes: entry.scenario.estimatedMinutes,
        bestPercent,
        completed: bestPercent != null && bestPercent >= threshold,
      };
    });

    const completedCount = scenarios.filter((s) => s.completed).length;
    const certificate = await this.prisma.certificate.findUnique({
      where: {
        userId_learningPathId: { userId: user.id, learningPathId: pathId },
      },
    });

    return {
      id: path.id,
      slug: path.slug,
      title: path.title,
      courseTitle: path.course.title,
      passThresholdPercent: threshold,
      scenarios,
      completedCount,
      totalCount: scenarios.length,
      isComplete: completedCount === scenarios.length,
      certificateId: certificate ? certificate.id : null,
    };
  }
}
