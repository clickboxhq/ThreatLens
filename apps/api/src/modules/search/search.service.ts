import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { toStudentSignInDto } from '../../common/dto/sign-in.dto';
import { toStudentEmailDto } from '../../common/dto/email.dto';
import { toStudentCloudEventDto } from '../../common/dto/cloud.dto';
import {
  toStudentProcessEventDto,
  toStudentFileEventDto,
  toStudentNetworkEventDto,
  toStudentHttpRequestDto,
} from '../../common/dto/device.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { Prisma } from '@prisma/client';

const SIGN_IN_FIELDS = new Set([
  'sourceIp',
  'sourceCountry',
  'sourceCity',
  'application',
]);
const EMAIL_FIELDS = new Set(['senderAddress', 'subject', 'recipientAddress']);
const CLOUD_FIELDS = new Set(['sourceIp', 'resourceId', 'actionName']);
const PROCESS_FIELDS = new Set(['imagePath', 'commandLine']);
const FILE_FIELDS = new Set(['filePath']);
const NETWORK_FIELDS = new Set(['remoteIp']);
const HTTP_FIELDS = new Set(['url', 'sourceIp']);

// Results are capped per entity type, not overall — a handful of extra event tables now
// contributing doesn't change what one type can flood the response with.
const PER_TYPE_LIMIT = 100;

interface SearchFilter {
  field: string;
  value: string;
}

// §2.8 / §16.12: field=value search over the session's own telemetry — deliberately not a
// general-purpose query language (§1.6), but wide enough to cover every entity surface the
// ThreatLens frontend's search box implies (identity, endpoint, email, cloud), which the
// original narrower version (sign-ins + email only) didn't.
//
// Deliberately NOT supported: filtering by mitre technique. ThreatLens's own inherited search
// placeholder mentions `mitre=T1528` — that UI copy comes from a system with no ground-truth
// boundary at all. Here, an event's mitreTechniqueId tag is exactly the answer key (§12.3) —
// letting a Student filter search results by it would hand them ground truth directly, the
// same reason toStudent*Dto mappers throughout this codebase all strip that field. The frontend
// should not offer this filter even though the field name is easy to type.
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async search(
    sessionId: string,
    user: AuthenticatedUser,
    filters: SearchFilter[],
    freetext?: string,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);

    const signInWhere: Prisma.SignInEventWhereInput = { sessionId };
    const emailWhere: Prisma.EmailMessageWhereInput = { sessionId };
    const cloudWhere: Prisma.CloudEventWhereInput = { sessionId };
    const processWhere: Prisma.ProcessEventWhereInput = { sessionId };
    const fileWhere: Prisma.FileEventWhereInput = { sessionId };
    const networkWhere: Prisma.NetworkEventWhereInput = { sessionId };
    const httpWhere: Prisma.HttpRequestWhereInput = { sessionId };

    for (const filter of filters) {
      if (SIGN_IN_FIELDS.has(filter.field)) {
        (signInWhere as Record<string, unknown>)[filter.field] = {
          equals: filter.value,
          mode: 'insensitive',
        };
      }
      if (filter.field === 'senderAddress' || filter.field === 'subject') {
        (emailWhere as Record<string, unknown>)[filter.field] = {
          contains: filter.value,
          mode: 'insensitive',
        };
      }
      if (filter.field === 'recipientAddress') {
        emailWhere.recipientAddresses = { has: filter.value };
      }
      if (CLOUD_FIELDS.has(filter.field)) {
        (cloudWhere as Record<string, unknown>)[filter.field] =
          filter.field === 'sourceIp'
            ? { equals: filter.value, mode: 'insensitive' }
            : { contains: filter.value, mode: 'insensitive' };
      }
      if (PROCESS_FIELDS.has(filter.field)) {
        (processWhere as Record<string, unknown>)[filter.field] = {
          contains: filter.value,
          mode: 'insensitive',
        };
      }
      if (FILE_FIELDS.has(filter.field)) {
        (fileWhere as Record<string, unknown>)[filter.field] = {
          contains: filter.value,
          mode: 'insensitive',
        };
      }
      if (NETWORK_FIELDS.has(filter.field)) {
        (networkWhere as Record<string, unknown>)[filter.field] = {
          equals: filter.value,
          mode: 'insensitive',
        };
      }
      if (HTTP_FIELDS.has(filter.field)) {
        (httpWhere as Record<string, unknown>)[filter.field] =
          filter.field === 'sourceIp'
            ? { equals: filter.value, mode: 'insensitive' }
            : { contains: filter.value, mode: 'insensitive' };
      }
    }

    if (freetext) {
      emailWhere.OR = [
        { subject: { contains: freetext, mode: 'insensitive' } },
        { senderAddress: { contains: freetext, mode: 'insensitive' } },
        { bodyHtml: { contains: freetext, mode: 'insensitive' } },
      ];
      cloudWhere.OR = [
        { actionName: { contains: freetext, mode: 'insensitive' } },
        { resourceId: { contains: freetext, mode: 'insensitive' } },
      ];
      processWhere.OR = [
        { imagePath: { contains: freetext, mode: 'insensitive' } },
        { commandLine: { contains: freetext, mode: 'insensitive' } },
      ];
      fileWhere.OR = [
        { filePath: { contains: freetext, mode: 'insensitive' } },
      ];
      httpWhere.OR = [{ url: { contains: freetext, mode: 'insensitive' } }];
    }

    const hasSignInFilter = filters.some((f) => SIGN_IN_FIELDS.has(f.field));
    const hasEmailFilter =
      filters.some((f) => EMAIL_FIELDS.has(f.field)) || Boolean(freetext);
    const hasCloudFilter =
      filters.some((f) => CLOUD_FIELDS.has(f.field)) || Boolean(freetext);
    const hasProcessFilter =
      filters.some((f) => PROCESS_FIELDS.has(f.field)) || Boolean(freetext);
    const hasFileFilter =
      filters.some((f) => FILE_FIELDS.has(f.field)) || Boolean(freetext);
    const hasNetworkFilter = filters.some((f) => NETWORK_FIELDS.has(f.field));
    const hasHttpFilter =
      filters.some((f) => HTTP_FIELDS.has(f.field)) || Boolean(freetext);
    const searchEverything = filters.length === 0 && !freetext;

    const [
      signIns,
      emails,
      cloudEvents,
      processEvents,
      fileEvents,
      networkEvents,
      httpRequests,
    ] = await Promise.all([
      hasSignInFilter || searchEverything
        ? this.prisma.signInEvent.findMany({
            where: signInWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasEmailFilter || searchEverything
        ? this.prisma.emailMessage.findMany({
            where: emailWhere,
            include: { attachments: true, urls: true },
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasCloudFilter || searchEverything
        ? this.prisma.cloudEvent.findMany({
            where: cloudWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasProcessFilter || searchEverything
        ? this.prisma.processEvent.findMany({
            where: processWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasFileFilter || searchEverything
        ? this.prisma.fileEvent.findMany({
            where: fileWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasNetworkFilter || searchEverything
        ? this.prisma.networkEvent.findMany({
            where: networkWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
          })
        : Promise.resolve([]),
      hasHttpFilter || searchEverything
        ? this.prisma.httpRequest.findMany({
            where: httpWhere,
            orderBy: { occurredAt: 'desc' },
            take: PER_TYPE_LIMIT,
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
      ...signIns.map((event) => ({
        entityType: 'sign_in_event' as const,
        occurredAt: event.occurredAt,
        data: toStudentSignInDto(event),
      })),
      ...emails.map((email) => ({
        entityType: 'email_message' as const,
        occurredAt: email.occurredAt,
        data: toStudentEmailDto(email),
      })),
      ...cloudEvents.map((event) => ({
        entityType: 'cloud_event' as const,
        occurredAt: event.occurredAt,
        data: toStudentCloudEventDto(event),
      })),
      ...processEvents.map((event) => ({
        entityType: 'process_event' as const,
        occurredAt: event.occurredAt,
        data: toStudentProcessEventDto(event),
      })),
      ...fileEvents.map((event) => ({
        entityType: 'file_event' as const,
        occurredAt: event.occurredAt,
        data: toStudentFileEventDto(event),
      })),
      ...networkEvents.map((event) => ({
        entityType: 'network_event' as const,
        occurredAt: event.occurredAt,
        data: toStudentNetworkEventDto(event),
      })),
      ...httpRequests.map((event) => ({
        entityType: 'http_request' as const,
        occurredAt: event.occurredAt,
        data: toStudentHttpRequestDto(event),
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { results };
  }
}
