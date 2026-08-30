import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentEmailDto } from '../../common/dto/email.dto';
import { computeEmailInsights } from '../session-core/entity-insights';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { EmailDirection, Prisma, SpfResult } from '@prisma/client';

@Injectable()
export class EmailPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(
    sessionId: string,
    user: AuthenticatedUser,
    filters: {
      direction?: EmailDirection;
      spfResult?: SpfResult;
      senderContains?: string;
      subjectContains?: string;
    },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const where: Prisma.EmailMessageWhereInput = { sessionId };
    if (filters.direction) where.direction = filters.direction;
    if (filters.spfResult) where.spfResult = filters.spfResult;
    if (filters.senderContains)
      where.senderAddress = {
        contains: filters.senderContains,
        mode: 'insensitive',
      };
    if (filters.subjectContains)
      where.subject = {
        contains: filters.subjectContains,
        mode: 'insensitive',
      };

    const emails = await this.prisma.emailMessage.findMany({
      where,
      include: { attachments: true, urls: true },
      orderBy: { occurredAt: 'desc' },
    });
    return emails.map(toStudentEmailDto);
  }

  async getMessage(
    sessionId: string,
    emailId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, sessionId },
      include: { attachments: true, urls: true },
    });
    if (!email) throw new AppException(404, 'NOT_FOUND', 'Email not found.');

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'email_message',
      targetId: emailId,
    });

    return toStudentEmailDto(email);
  }

  async getSimilar(
    sessionId: string,
    emailId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, sessionId },
    });
    if (!email) throw new AppException(404, 'NOT_FOUND', 'Email not found.');

    const senderDomain = email.senderAddress.split('@')[1];
    const similar = await this.prisma.emailMessage.findMany({
      where: {
        sessionId,
        id: { not: emailId },
        senderAddress: { endsWith: `@${senderDomain}` },
      },
      include: { attachments: true, urls: true },
      orderBy: { occurredAt: 'asc' },
    });
    return similar.map(toStudentEmailDto);
  }

  /**
   * §2.6: "did anyone actually click it?" — the pivot that turns a suspicious email from a
   * delivered message into a confirmed compromise. Matches each of the email's URLs against
   * the session's own HTTP telemetry, so the answer is derived from the same evidence the
   * Student can already find by hand rather than from any ground-truth flag (an email's
   * isGroundTruthEvidence/mitreTechniqueId are never read here — a click on a benign link is
   * reported exactly the same way as a click on a malicious one, and the Student still has to
   * judge which is which).
   */
  async getLinkActivity(
    sessionId: string,
    emailId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, sessionId },
      include: { urls: true },
    });
    if (!email) throw new AppException(404, 'NOT_FOUND', 'Email not found.');
    if (email.urls.length === 0) return [];

    const requests = await this.prisma.httpRequest.findMany({
      where: { sessionId, url: { in: email.urls.map((u) => u.url) } },
      include: { device: true },
      orderBy: { occurredAt: 'asc' },
    });

    // HttpRequest.identityId is nullable and carries no relation, so the display name is
    // resolved in one batched lookup rather than a per-row join.
    const identityIds = [
      ...new Set(
        requests
          .map((r) => r.identityId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const identities = identityIds.length
      ? await this.prisma.identity.findMany({
          where: { id: { in: identityIds } },
          select: { id: true, displayName: true, userPrincipalName: true },
        })
      : [];
    const identityById = new Map(identities.map((i) => [i.id, i]));

    return email.urls.map((url) => {
      const clicks = requests.filter((r) => r.url === url.url);
      return {
        urlId: url.id,
        url: url.url,
        reputation: url.reputation,
        clickCount: clicks.length,
        clicks: clicks.map((c) => {
          const identity = c.identityId
            ? identityById.get(c.identityId)
            : undefined;
          return {
            // The HttpRequest's own id, so the click can be pinned as evidence straight from
            // the link-activity panel. Without it a learner who has just established that the
            // link *was* opened — the fact that connects the email to everything after it —
            // would have to go and find the same event again through search to cite it.
            id: c.id,
            occurredAt: c.occurredAt,
            statusCode: c.statusCode,
            sourceIp: c.sourceIp,
            userAgent: c.userAgent,
            identityId: c.identityId,
            identityDisplayName: identity?.displayName ?? null,
            identityUserPrincipalName: identity?.userPrincipalName ?? null,
            deviceId: c.deviceId,
            deviceHostname: c.device?.hostname ?? null,
          };
        }),
      };
    });
  }

  // See entity-insights.ts. sameDomainCount and linkClickCount reuse exactly what the
  // "similar messages" and "link activity" pivots already expose, so an insight never points
  // somewhere the Student cannot go and verify for themselves.
  async getInsights(
    sessionId: string,
    emailId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const email = await this.prisma.emailMessage.findFirst({
      where: { id: emailId, sessionId },
      include: { attachments: true, urls: true },
    });
    if (!email) throw new AppException(404, 'NOT_FOUND', 'Email not found.');

    const senderDomain = email.senderAddress.split('@')[1] ?? '';
    const [sameDomainCount, linkClickCount] = await Promise.all([
      this.prisma.emailMessage.count({
        where: {
          sessionId,
          id: { not: emailId },
          senderAddress: { endsWith: `@${senderDomain}` },
        },
      }),
      email.urls.length
        ? this.prisma.httpRequest.count({
            where: { sessionId, url: { in: email.urls.map((u) => u.url) } },
          })
        : Promise.resolve(0),
    ]);

    return computeEmailInsights({
      senderAddress: email.senderAddress,
      recipientAddresses: email.recipientAddresses,
      spfResult: email.spfResult,
      dkimResult: email.dkimResult,
      dmarcResult: email.dmarcResult,
      headers: (email.headersRaw ?? {}) as Record<string, unknown>,
      urlCount: email.urls.length,
      attachmentCount: email.attachments.length,
      sameDomainCount,
      linkClickCount,
      senderDomainRegisteredAt: email.senderDomainRegisteredAt,
      now: new Date(),
    });
  }
}
