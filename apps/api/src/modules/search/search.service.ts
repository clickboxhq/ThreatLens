import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { toStudentSignInDto } from '../../common/dto/sign-in.dto';
import { toStudentEmailDto } from '../../common/dto/email.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { Prisma } from '@prisma/client';

const SIGN_IN_FIELDS = new Set(['sourceIp', 'sourceCountry', 'sourceCity', 'application']);
const EMAIL_FIELDS = new Set(['senderAddress', 'subject', 'recipientAddress']);

interface SearchFilter {
  field: string;
  value: string;
}

// §2.8 / §16.12: deliberately simplified field=value search over the session's own
// telemetry — not a general-purpose query language (§1.6).
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async search(sessionId: string, user: AuthenticatedUser, filters: SearchFilter[], freetext?: string) {
    await this.sessionAccess.getOwnedSession(sessionId, user);

    const signInWhere: Prisma.SignInEventWhereInput = { sessionId };
    const emailWhere: Prisma.EmailMessageWhereInput = { sessionId };

    for (const filter of filters) {
      if (SIGN_IN_FIELDS.has(filter.field)) {
        (signInWhere as Record<string, unknown>)[filter.field] = { equals: filter.value, mode: 'insensitive' };
      }
      if (filter.field === 'senderAddress' || filter.field === 'subject') {
        (emailWhere as Record<string, unknown>)[filter.field] = { contains: filter.value, mode: 'insensitive' };
      }
      if (filter.field === 'recipientAddress') {
        emailWhere.recipientAddresses = { has: filter.value };
      }
    }

    if (freetext) {
      emailWhere.OR = [
        { subject: { contains: freetext, mode: 'insensitive' } },
        { senderAddress: { contains: freetext, mode: 'insensitive' } },
        { bodyHtml: { contains: freetext, mode: 'insensitive' } },
      ];
    }

    const hasSignInFilter = filters.some((f) => SIGN_IN_FIELDS.has(f.field));
    const hasEmailFilter = filters.some((f) => EMAIL_FIELDS.has(f.field)) || Boolean(freetext);
    const searchEverything = filters.length === 0 && !freetext;

    const [signIns, emails] = await Promise.all([
      hasSignInFilter || searchEverything
        ? this.prisma.signInEvent.findMany({ where: signInWhere, orderBy: { occurredAt: 'desc' }, take: 100 })
        : Promise.resolve([]),
      hasEmailFilter || searchEverything
        ? this.prisma.emailMessage.findMany({
            where: emailWhere,
            include: { attachments: true, urls: true },
            orderBy: { occurredAt: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'search',
      targetType: 'session',
      targetId: sessionId,
      metadata: { filters, freetext } as unknown as Prisma.InputJsonValue,
    });

    const results = [
      ...signIns.map((event) => ({ entityType: 'sign_in_event' as const, occurredAt: event.occurredAt, data: toStudentSignInDto(event) })),
      ...emails.map((email) => ({ entityType: 'email_message' as const, occurredAt: email.occurredAt, data: toStudentEmailDto(email) })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { results };
  }
}
