import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentEmailDto } from '../../common/dto/email.dto';
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
    filters: { direction?: EmailDirection; spfResult?: SpfResult; senderContains?: string; subjectContains?: string },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const where: Prisma.EmailMessageWhereInput = { sessionId };
    if (filters.direction) where.direction = filters.direction;
    if (filters.spfResult) where.spfResult = filters.spfResult;
    if (filters.senderContains) where.senderAddress = { contains: filters.senderContains, mode: 'insensitive' };
    if (filters.subjectContains) where.subject = { contains: filters.subjectContains, mode: 'insensitive' };

    const emails = await this.prisma.emailMessage.findMany({
      where,
      include: { attachments: true, urls: true },
      orderBy: { occurredAt: 'desc' },
    });
    return emails.map(toStudentEmailDto);
  }

  async getMessage(sessionId: string, emailId: string, user: AuthenticatedUser) {
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

  async getSimilar(sessionId: string, emailId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const email = await this.prisma.emailMessage.findFirst({ where: { id: emailId, sessionId } });
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
}
