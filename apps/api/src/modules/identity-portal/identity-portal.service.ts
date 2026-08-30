import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentIdentityDto } from '../../common/dto/identity.dto';
import { toStudentSignInDto } from '../../common/dto/sign-in.dto';
import { toStudentCloudEventDto } from '../../common/dto/cloud.dto';
import { toStudentDirectoryAuditDto } from '../../common/dto/directory-audit.dto';
import {
  distanceBetweenCitiesKm,
  impliedTravelSpeedKmh,
} from '../../common/geo';
import { deriveRiskByEntityId } from '../session-core/entity-risk';
import { computeIdentityInsights } from '../session-core/entity-insights';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  IdentityRiskLevel,
  MfaStatus,
  Prisma,
  SignInResult,
} from '@prisma/client';

@Injectable()
export class IdentityPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(
    sessionId: string,
    user: AuthenticatedUser,
    filters: {
      riskLevel?: IdentityRiskLevel;
      department?: string;
      mfaStatus?: MfaStatus;
    },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identities = await this.prisma.identity.findMany({
      where: {
        sessionId,
        department: filters.department,
        mfaStatus: filters.mfaStatus,
      },
      orderBy: { displayName: 'asc' },
    });

    // riskLevel comes from open alerts, not the stored column (always 'none' — see
    // entity-risk.ts), so its filter is applied here rather than in the query.
    const risk = await this.riskByEntity(sessionId, 'identity');
    const withRisk = identities.map((identity) => ({
      ...toStudentIdentityDto(identity),
      riskLevel: risk.get(identity.id) ?? 'none',
    }));

    return filters.riskLevel
      ? withRisk.filter((i) => i.riskLevel === filters.riskLevel)
      : withRisk;
  }

  private async riskByEntity(sessionId: string, type: 'identity' | 'device') {
    const alerts = await this.prisma.alert.findMany({
      where: { sessionId, primaryEntityType: type },
      select: { primaryEntityId: true, severity: true, status: true },
    });
    return deriveRiskByEntityId(alerts);
  }

  async getProfile(
    sessionId: string,
    identityId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({
      where: { id: identityId, sessionId },
    });
    if (!identity)
      throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'identity',
      targetId: identityId,
    });

    const devices = await this.prisma.device.findMany({
      where: { sessionId, primaryIdentityId: identityId },
    });

    // The identity's own risk and its devices' risk come from different alert sets — a user
    // can be quiet while their workstation is the one alerting, and the profile should say so.
    const [identityRisk, deviceRisk] = await Promise.all([
      this.riskByEntity(sessionId, 'identity'),
      this.riskByEntity(sessionId, 'device'),
    ]);

    return {
      ...toStudentIdentityDto(identity),
      riskLevel: identityRisk.get(identityId) ?? 'none',
      devices: devices.map((d) => ({
        id: d.id,
        hostname: d.hostname,
        osPlatform: d.osPlatform,
        riskLevel: deviceRisk.get(d.id) ?? 'none',
      })),
    };
  }

  async getSignIns(
    sessionId: string,
    identityId: string,
    user: AuthenticatedUser,
    filters: { result?: SignInResult; riskyOnly?: boolean },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({
      where: { id: identityId, sessionId },
    });
    if (!identity)
      throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const where: Prisma.SignInEventWhereInput = { sessionId, identityId };
    if (filters.result) where.result = filters.result;

    const events = await this.prisma.signInEvent.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
    });

    let riskyAlertEntityIds = new Set<string>();
    if (filters.riskyOnly) {
      const riskyAlerts = await this.prisma.alert.findMany({
        where: {
          sessionId,
          primaryEntityType: 'identity',
          primaryEntityId: identityId,
        },
        include: { evidenceRefs: true },
      });
      riskyAlertEntityIds = new Set(
        riskyAlerts.flatMap((a) =>
          a.evidenceRefs
            .filter((r) => r.eventTable === 'sign_in_events')
            .map((r) => r.eventId),
        ),
      );
    }

    const withDistance = events.map((event, index) => {
      const previous = index > 0 ? events[index - 1] : null;
      let distanceFromPreviousKm: number | null = null;
      let impliedTravelSpeedKmhValue: number | null = null;
      if (previous && previous.sourceCity !== event.sourceCity) {
        distanceFromPreviousKm = distanceBetweenCitiesKm(
          previous.sourceCity,
          event.sourceCity,
        );
        if (distanceFromPreviousKm !== null) {
          const minutesElapsed =
            (event.occurredAt.getTime() - previous.occurredAt.getTime()) /
            60000;
          impliedTravelSpeedKmhValue = impliedTravelSpeedKmh(
            distanceFromPreviousKm,
            minutesElapsed,
          );
        }
      }
      return {
        ...toStudentSignInDto(event),
        distanceFromPreviousKm:
          distanceFromPreviousKm !== null
            ? Math.round(distanceFromPreviousKm)
            : null,
        impliedTravelSpeedKmh:
          impliedTravelSpeedKmhValue !== null
            ? Math.round(impliedTravelSpeedKmhValue)
            : null,
      };
    });

    return filters.riskyOnly
      ? withDistance.filter((e) => riskyAlertEntityIds.has(e.id))
      : withDistance;
  }

  async getCloudEvents(
    sessionId: string,
    identityId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({
      where: { id: identityId, sessionId },
    });
    if (!identity)
      throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const events = await this.prisma.cloudEvent.findMany({
      where: { sessionId, identityId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map(toStudentCloudEventDto);
  }

  // §2.15: "what was done *to* this account", as distinct from getSignIns' "when did it
  // authenticate". Account takeover surfaces here first — an attacker who lands a session
  // registers their own MFA method or adds a forwarding rule, neither of which is a sign-in.
  async getAuditEvents(
    sessionId: string,
    identityId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({
      where: { id: identityId, sessionId },
    });
    if (!identity)
      throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const events = await this.prisma.directoryAuditEvent.findMany({
      where: { sessionId, targetIdentityId: identityId },
      orderBy: { occurredAt: 'desc' },
    });
    return events.map(toStudentDirectoryAuditDto);
  }

  // The questions a competent analyst would ask of this account, answered from the same
  // telemetry the Student can already reach (see entity-insights.ts on why the answers travel
  // with the questions rather than being withheld server-side).
  async getInsights(
    sessionId: string,
    identityId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({
      where: { id: identityId, sessionId },
    });
    if (!identity)
      throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const [signIns, auditEvents, cloudEventCount] = await Promise.all([
      this.prisma.signInEvent.findMany({
        where: { sessionId, identityId },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.directoryAuditEvent.findMany({
        where: { sessionId, targetIdentityId: identityId },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.cloudEvent.count({ where: { sessionId, identityId } }),
    ]);

    return computeIdentityInsights({
      identityId,
      homeCountry: identity.homeCountry,
      mfaStatus: identity.mfaStatus,
      isPrivileged: identity.isPrivileged,
      signIns: signIns.map((s) => ({
        occurredAt: s.occurredAt,
        sourceCountry: s.sourceCountry,
        sourceCity: s.sourceCity,
        result: s.result,
        isLegacyAuth: s.isLegacyAuth,
      })),
      auditEvents: auditEvents.map((e) => ({
        occurredAt: e.occurredAt,
        category: e.category,
        action: e.action,
        actorIdentityId: e.actorIdentityId,
      })),
      cloudEventCount,
    });
  }
}
