import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException } from '../../../common/exceptions/app-exception';
import { AuditLogService } from '../../../common/audit-log/audit-log.service';
import { ADMIN_AUDIT } from '../admin-audit';
import { toPage, type Page } from '../dto/pagination.query';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

export interface AdminCertificateRow {
  id: string;
  holder: { id: string; displayName: string; email: string };
  type: string;
  issuedAt: string;
  // The public id shown on the certificate and the /verify page (TL-YYYY-XXXXXXXX).
  verificationId: string;
  status: 'active' | 'revoked';
  revokedAt: string | null;
}

function certType(cert: {
  course: { title: string } | null;
  learningPath: { title: string } | null;
}): string {
  if (cert.course) return `${cert.course.title} Career Track`;
  return cert.learningPath?.title ?? 'Certificate';
}

@Injectable()
export class AdminCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(query: {
    page: number;
    limit: number;
    search?: string;
    status?: 'active' | 'revoked';
  }): Promise<Page<AdminCertificateRow>> {
    const where: Prisma.CertificateWhereInput = {};
    if (query.status === 'active') where.revokedAt = null;
    if (query.status === 'revoked') where.revokedAt = { not: null };
    if (query.search) {
      where.OR = [
        { publicId: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        {
          user: {
            displayName: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          course: { title: { contains: query.search, mode: 'insensitive' } },
        },
        {
          learningPath: {
            title: { contains: query.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, certs] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          publicId: true,
          issuedAt: true,
          revokedAt: true,
          user: { select: { id: true, displayName: true, email: true } },
          course: { select: { title: true } },
          learningPath: { select: { title: true } },
        },
      }),
    ]);

    return toPage(
      certs.map((c) => ({
        id: c.id,
        holder: c.user,
        type: certType(c),
        issuedAt: c.issuedAt.toISOString(),
        verificationId: c.publicId,
        status: (c.revokedAt ? 'revoked' : 'active') as 'active' | 'revoked',
        revokedAt: c.revokedAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  }

  /** Total issued + a per-career-track breakdown, for the admin certificates page. */
  async stats() {
    const [total, active, revoked, byCourse] = await Promise.all([
      this.prisma.certificate.count(),
      this.prisma.certificate.count({ where: { revokedAt: null } }),
      this.prisma.certificate.count({ where: { revokedAt: { not: null } } }),
      this.prisma.certificate.groupBy({
        by: ['courseId'],
        where: { courseId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const courses = await this.prisma.course.findMany({
      where: { id: { in: byCourse.map((r) => r.courseId!) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(courses.map((c) => [c.id, c.title]));
    return {
      total,
      active,
      revoked,
      byCareerTrack: byCourse
        .map((r) => ({
          careerTrackName: `${titleById.get(r.courseId!) ?? 'Unknown'} Career Track`,
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async getDetail(id: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      select: {
        id: true,
        publicId: true,
        issuedAt: true,
        revokedAt: true,
        scoreSnapshot: true,
        user: { select: { id: true, displayName: true, email: true } },
        course: { select: { title: true } },
        learningPath: {
          select: { title: true, course: { select: { title: true } } },
        },
      },
    });
    if (!cert)
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    return {
      id: cert.id,
      verificationId: cert.publicId,
      status: cert.revokedAt ? 'revoked' : 'active',
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() ?? null,
      holder: cert.user,
      type: certType(cert),
      course:
        cert.course?.title ?? cert.learningPath?.course.title ?? 'ThreatLens',
      scoreSnapshot: cert.scoreSnapshot,
    };
  }

  async revoke(
    admin: AuthenticatedUser,
    id: string,
    reason: string | undefined,
    actorIp?: string,
  ) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!cert)
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    if (cert.revokedAt) {
      throw new AppException(
        409,
        'ALREADY_REVOKED',
        'This certificate is already revoked.',
      );
    }

    await this.prisma.certificate.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action: ADMIN_AUDIT.certificateRevoked,
      targetType: 'certificate',
      targetId: id,
      metadata: reason ? { reason } : undefined,
    });
    return { id, status: 'revoked' as const };
  }

  // Un-revokes a previously revoked certificate and refreshes its issue date. The public
  // verification page keys on the same id, so verification keeps working — nothing about the
  // (userId, learningPathId) identity changes.
  async reissue(admin: AuthenticatedUser, id: string, actorIp?: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!cert)
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    if (!cert.revokedAt) {
      throw new AppException(
        409,
        'NOT_REVOKED',
        'This certificate is active — there is nothing to reissue.',
      );
    }

    await this.prisma.certificate.update({
      where: { id },
      data: { revokedAt: null, issuedAt: new Date() },
    });
    await this.auditLog.record({
      actorUserId: admin.id,
      actorIp: actorIp ?? null,
      action: ADMIN_AUDIT.certificateReissued,
      targetType: 'certificate',
      targetId: id,
    });
    return { id, status: 'active' as const };
  }
}
