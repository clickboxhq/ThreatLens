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
  // The verification id shown on the public /verify page — this is the certificate's own id.
  verificationId: string;
  status: 'active' | 'revoked';
  revokedAt: string | null;
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
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        {
          user: {
            displayName: { contains: query.search, mode: 'insensitive' },
          },
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
          issuedAt: true,
          revokedAt: true,
          user: { select: { id: true, displayName: true, email: true } },
          learningPath: { select: { title: true } },
        },
      }),
    ]);

    return toPage(
      certs.map((c) => ({
        id: c.id,
        holder: c.user,
        type: c.learningPath.title,
        issuedAt: c.issuedAt.toISOString(),
        verificationId: c.id,
        status: (c.revokedAt ? 'revoked' : 'active') as 'active' | 'revoked',
        revokedAt: c.revokedAt?.toISOString() ?? null,
      })),
      total,
      query,
    );
  }

  async getDetail(id: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { id },
      select: {
        id: true,
        issuedAt: true,
        revokedAt: true,
        scoreSnapshot: true,
        user: { select: { id: true, displayName: true, email: true } },
        learningPath: {
          select: {
            id: true,
            title: true,
            slug: true,
            course: { select: { title: true } },
          },
        },
      },
    });
    if (!cert)
      throw new AppException(404, 'NOT_FOUND', 'Certificate not found.');
    return {
      id: cert.id,
      verificationId: cert.id,
      status: cert.revokedAt ? 'revoked' : 'active',
      issuedAt: cert.issuedAt.toISOString(),
      revokedAt: cert.revokedAt?.toISOString() ?? null,
      holder: cert.user,
      type: cert.learningPath.title,
      course: cert.learningPath.course.title,
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
