import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // §13.4: called after a session is scored. Checks every learning path that includes the
  // just-scored scenario — if this score (or a better prior one) now clears the pass
  // threshold on every scenario in the path, and no certificate exists yet, issues one.
  // Deliberately no PDF/object-storage step here (§18.1's certificate rendering pipeline) —
  // see the Certificate model's comment for why this scope stops at the verification page.
  async checkAndIssueForScenario(
    userId: string,
    scenarioId: string,
  ): Promise<void> {
    const memberships = await this.prisma.learningPathScenario.findMany({
      where: { scenarioId },
      select: { learningPathId: true },
    });
    if (memberships.length === 0) return;

    for (const { learningPathId } of memberships) {
      await this.checkAndIssueForPath(userId, learningPathId);
    }
  }

  private async checkAndIssueForPath(
    userId: string,
    learningPathId: string,
  ): Promise<void> {
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_learningPathId: { userId, learningPathId } },
    });
    if (existing) return;

    const path = await this.prisma.learningPath.findUniqueOrThrow({
      where: { id: learningPathId },
      include: { scenarios: true },
    });
    const scenarioIds = path.scenarios.map((s) => s.scenarioId);

    const sessions = await this.prisma.investigationSession.findMany({
      where: { userId, scenarioId: { in: scenarioIds }, status: 'scored' },
      include: { score: true, scenario: true },
    });

    const bestByScenario = new Map<
      string,
      { percent: number; scenarioTitle: string }
    >();
    for (const session of sessions) {
      if (!session.score) continue;
      const percent = Number(session.score.overallPercent);
      const best = bestByScenario.get(session.scenarioId);
      if (!best || percent > best.percent) {
        bestByScenario.set(session.scenarioId, {
          percent,
          scenarioTitle: session.scenario.title,
        });
      }
    }

    const threshold = Number(path.passThresholdPercent);
    const allPassed =
      scenarioIds.length > 0 &&
      scenarioIds.every(
        (id) => (bestByScenario.get(id)?.percent ?? -1) >= threshold,
      );
    if (!allPassed) return;

    const scoreSnapshot = Object.fromEntries(
      [...bestByScenario.entries()].map(([scenarioId, v]) => [
        scenarioId,
        { title: v.scenarioTitle, percent: v.percent },
      ]),
    );

    await this.prisma.certificate.create({
      data: {
        userId,
        learningPathId,
        scoreSnapshot: scoreSnapshot as unknown as object,
      },
    });
    await this.notificationsService.create({
      userId,
      category: 'certificate_issued',
      title: 'Certificate issued',
      body: `${path.title} is ready to download.`,
      link: '/app/certificates',
    });
    this.logger.log(
      `Issued certificate for user ${userId}, learning path ${learningPathId}.`,
    );
  }

  async myCertificates(user: AuthenticatedUser) {
    const certificates = await this.prisma.certificate.findMany({
      where: { userId: user.id },
      include: { learningPath: true },
      orderBy: { issuedAt: 'desc' },
    });
    return certificates.map((c) => ({
      id: c.id,
      learningPathId: c.learningPathId,
      learningPathTitle: c.learningPath.title,
      issuedAt: c.issuedAt,
      revoked: c.revokedAt != null,
    }));
  }

  // §2.18: public, unauthenticated, minimal-PII — the learner's display name and which
  // path they completed, nothing else (no email, no per-scenario scores).
  async verify(certificateId: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: { learningPath: true, user: true },
    });
    if (!certificate)
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');

    return {
      id: certificate.id,
      learnerDisplayName: certificate.user.displayName,
      learningPathTitle: certificate.learningPath.title,
      issuedAt: certificate.issuedAt,
      valid: certificate.revokedAt == null,
    };
  }
}
