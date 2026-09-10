import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import * as QRCode from 'qrcode';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// Crockford-ish alphabet — no 0/O/1/I/L/U, so a public id read off a printed
// certificate or dictated over the phone doesn't get transcribed wrong.
const ID_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const ID_LENGTH = 8;

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private webOrigin(): string {
    return (
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  private verifyUrl(publicId: string): string {
    return `${this.webOrigin()}/verify/${publicId}`;
  }

  private newPublicId(): string {
    let body = '';
    for (let i = 0; i < ID_LENGTH; i++) {
      body += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
    }
    return `TL-${new Date().getFullYear()}-${body}`;
  }

  // ---- Issuance -----------------------------------------------------------

  /**
   * §13.4: called after a session is scored. A Career Track certificate is issued
   * once the learner clears the pass threshold on *every* scenario in *every*
   * learning path of a Course. Backend-only — the learner never triggers this and
   * cannot pass a courseId of their own.
   */
  async checkAndIssueForScenario(
    userId: string,
    scenarioId: string,
  ): Promise<void> {
    const paths = await this.prisma.learningPathScenario.findMany({
      where: { scenarioId },
      select: { learningPath: { select: { courseId: true } } },
    });
    const courseIds = [...new Set(paths.map((p) => p.learningPath.courseId))];

    for (const courseId of courseIds) {
      await this.checkAndIssueForCourse(userId, courseId);
    }
  }

  private async checkAndIssueForCourse(
    userId: string,
    courseId: string,
  ): Promise<void> {
    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return;

    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        learningPaths: {
          include: {
            scenarios: { include: { scenario: { select: { title: true } } } },
          },
        },
      },
    });

    // Every scenario across every path, with the threshold of its owning path.
    const required = new Map<string, { threshold: number; title: string }>();
    for (const path of course.learningPaths) {
      const threshold = Number(path.passThresholdPercent);
      for (const lps of path.scenarios) {
        const current = required.get(lps.scenarioId);
        // If a scenario sits in two paths, the harder threshold wins.
        if (!current || threshold > current.threshold) {
          required.set(lps.scenarioId, {
            threshold,
            title: lps.scenario.title,
          });
        }
      }
    }
    if (required.size === 0) return;

    const sessions = await this.prisma.investigationSession.findMany({
      where: {
        userId,
        scenarioId: { in: [...required.keys()] },
        status: 'scored',
      },
      include: { score: { select: { overallPercent: true } } },
    });
    const bestByScenario = new Map<string, number>();
    for (const s of sessions) {
      if (!s.score) continue;
      const percent = Number(s.score.overallPercent);
      if (percent > (bestByScenario.get(s.scenarioId) ?? -1)) {
        bestByScenario.set(s.scenarioId, percent);
      }
    }

    const allPassed = [...required.entries()].every(
      ([id, r]) => (bestByScenario.get(id) ?? -1) >= r.threshold,
    );
    if (!allPassed) return;

    const scoreSnapshot = Object.fromEntries(
      [...required.entries()].map(([id, r]) => [
        id,
        { title: r.title, percent: bestByScenario.get(id) ?? 0 },
      ]),
    );

    await this.createWithUniquePublicId({
      userId,
      courseId,
      scoreSnapshot,
    });

    await this.notificationsService.create({
      userId,
      category: 'certificate_issued',
      title: 'Career Track certificate issued',
      body: `You've completed the ${course.title} Career Track — your certificate is ready.`,
      link: '/app/certificates',
    });
    this.logger.log(
      `Issued Career Track certificate: user ${userId}, course ${courseId}.`,
    );
  }

  private async createWithUniquePublicId(data: {
    userId: string;
    courseId: string;
    scoreSnapshot: Record<string, unknown>;
  }): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await this.prisma.certificate.create({
          data: {
            userId: data.userId,
            courseId: data.courseId,
            publicId: this.newPublicId(),
            scoreSnapshot:
              data.scoreSnapshot as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      } catch (err) {
        // P2002 on public_id => regenerate and retry. P2002 on (user, course) =>
        // a concurrent scoring job already issued it; nothing to do.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          const target = (err.meta?.target ?? []) as string[];
          if (target.some((t) => t.includes('course'))) return;
          continue;
        }
        throw err;
      }
    }
    throw new Error(
      'Could not allocate a unique certificate id after retries.',
    );
  }

  // ---- Learner-facing reads ---------------------------------------------

  async myCertificates(user: AuthenticatedUser) {
    const certs = await this.prisma.certificate.findMany({
      where: { userId: user.id },
      include: {
        course: { select: { title: true } },
        learningPath: { select: { title: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
    return certs.map((c) => ({
      publicId: c.publicId,
      careerTrackName: certTrackName(c),
      issuedAt: c.issuedAt,
      revoked: c.revokedAt != null,
    }));
  }

  /** Full certificate for the owner's view page — includes the QR the document renders. */
  async getMine(user: AuthenticatedUser, publicId: string) {
    const cert = await this.loadByPublicId(publicId);
    if (!cert || cert.userId !== user.id) {
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    }
    return this.toFullDto(cert);
  }

  /**
   * §2.18/§16.15: public, unauthenticated. Accepts the public id (TL-...) or, for
   * links shared before public ids existed, the raw certificate uuid. Minimal PII:
   * recipient name, track, dates, status — no email, no per-scenario scores.
   */
  async verify(idOrPublicId: string) {
    const cert = await this.loadByPublicId(idOrPublicId);
    if (!cert) {
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    }
    return this.toFullDto(cert);
  }

  private async loadByPublicId(idOrPublicId: string) {
    const value = idOrPublicId.trim();
    const where: Prisma.CertificateWhereInput = isUuid(value)
      ? { OR: [{ publicId: value }, { id: value }] }
      : { publicId: value };
    return this.prisma.certificate.findFirst({
      where,
      include: {
        user: {
          select: { displayName: true, firstName: true, lastName: true },
        },
        course: { select: { title: true } },
        learningPath: { select: { title: true } },
      },
    });
  }

  private async toFullDto(
    cert: Prisma.CertificateGetPayload<{
      include: {
        user: {
          select: { displayName: true; firstName: true; lastName: true };
        };
        course: { select: { title: true } };
        learningPath: { select: { title: true } };
      };
    }>,
  ) {
    const url = this.verifyUrl(cert.publicId);
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
    });
    return {
      certificateId: cert.publicId,
      recipientName: recipientName(cert.user),
      careerTrackName: certTrackName(cert),
      completedAt: cert.issuedAt,
      issuedAt: cert.issuedAt,
      status: (cert.revokedAt ? 'revoked' : 'active') as 'active' | 'revoked',
      verifyUrl: url,
      qrDataUrl,
    };
  }

  // ---- Career Track progress (drives the "8 of 10" view) ----------------

  async careerTrackProgress(user: AuthenticatedUser) {
    const courses = await this.prisma.course.findMany({
      include: {
        learningPaths: {
          include: { scenarios: { select: { scenarioId: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const certs = await this.prisma.certificate.findMany({
      where: { userId: user.id, courseId: { not: null } },
      select: { courseId: true, publicId: true, revokedAt: true },
    });
    const certByCourse = new Map(certs.map((c) => [c.courseId!, c]));

    // One pass over the user's scored sessions for every relevant scenario.
    const allScenarioIds = [
      ...new Set(
        courses.flatMap((c) =>
          c.learningPaths.flatMap((p) => p.scenarios.map((s) => s.scenarioId)),
        ),
      ),
    ];
    const sessions = allScenarioIds.length
      ? await this.prisma.investigationSession.findMany({
          where: {
            userId: user.id,
            scenarioId: { in: allScenarioIds },
            status: 'scored',
          },
          include: { score: { select: { overallPercent: true } } },
        })
      : [];
    const bestByScenario = new Map<string, number>();
    for (const s of sessions) {
      if (!s.score) continue;
      const percent = Number(s.score.overallPercent);
      if (percent > (bestByScenario.get(s.scenarioId) ?? -1)) {
        bestByScenario.set(s.scenarioId, percent);
      }
    }

    return courses.map((course) => {
      const required = new Map<string, number>();
      for (const path of course.learningPaths) {
        const threshold = Number(path.passThresholdPercent);
        for (const lps of path.scenarios) {
          required.set(
            lps.scenarioId,
            Math.max(required.get(lps.scenarioId) ?? 0, threshold),
          );
        }
      }
      const total = required.size;
      const completed = [...required.entries()].filter(
        ([id, threshold]) => (bestByScenario.get(id) ?? -1) >= threshold,
      ).length;
      const cert = certByCourse.get(course.id);
      return {
        courseId: course.id,
        careerTrackName: `${course.title} Career Track`,
        requiredCount: total,
        completedCount: completed,
        eligible: total > 0 && completed === total,
        certificate: cert
          ? {
              publicId: cert.publicId,
              revoked: cert.revokedAt != null,
            }
          : null,
      };
    });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function recipientName(user: {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.displayName;
}

function certTrackName(cert: {
  course: { title: string } | null;
  learningPath: { title: string } | null;
}): string {
  if (cert.course) return `${cert.course.title} Career Track`;
  // Legacy path-level certificate.
  return cert.learningPath?.title ?? 'ThreatLens Career Track';
}
