import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import { toStudentIdentityDto } from '../../common/dto/identity.dto';
import { toStudentSignInDto } from '../../common/dto/sign-in.dto';
import { toStudentCloudEventDto } from '../../common/dto/cloud.dto';
import { distanceBetweenCitiesKm, impliedTravelSpeedKmh } from '../../common/geo';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { IdentityRiskLevel, MfaStatus, Prisma, SignInResult } from '@prisma/client';

@Injectable()
export class IdentityPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(sessionId: string, user: AuthenticatedUser, filters: { riskLevel?: IdentityRiskLevel; department?: string; mfaStatus?: MfaStatus }) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identities = await this.prisma.identity.findMany({
      where: {
        sessionId,
        riskLevel: filters.riskLevel,
        department: filters.department,
        mfaStatus: filters.mfaStatus,
      },
      orderBy: { displayName: 'asc' },
    });
    return identities.map(toStudentIdentityDto);
  }

  async getProfile(sessionId: string, identityId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({ where: { id: identityId, sessionId } });
    if (!identity) throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'identity',
      targetId: identityId,
    });

    const devices = await this.prisma.device.findMany({ where: { sessionId, primaryIdentityId: identityId } });

    return {
      ...toStudentIdentityDto(identity),
      devices: devices.map((d) => ({ id: d.id, hostname: d.hostname, osPlatform: d.osPlatform, riskLevel: d.riskLevel })),
    };
  }

  async getSignIns(sessionId: string, identityId: string, user: AuthenticatedUser, filters: { result?: SignInResult; riskyOnly?: boolean }) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({ where: { id: identityId, sessionId } });
    if (!identity) throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const where: Prisma.SignInEventWhereInput = { sessionId, identityId };
    if (filters.result) where.result = filters.result;

    const events = await this.prisma.signInEvent.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
    });

    let riskyAlertEntityIds = new Set<string>();
    if (filters.riskyOnly) {
      const riskyAlerts = await this.prisma.alert.findMany({
        where: { sessionId, primaryEntityType: 'identity', primaryEntityId: identityId },
        include: { evidenceRefs: true },
      });
      riskyAlertEntityIds = new Set(
        riskyAlerts.flatMap((a) => a.evidenceRefs.filter((r) => r.eventTable === 'sign_in_events').map((r) => r.eventId)),
      );
    }

    const withDistance = events.map((event, index) => {
      const previous = index > 0 ? events[index - 1] : null;
      let distanceFromPreviousKm: number | null = null;
      let impliedTravelSpeedKmhValue: number | null = null;
      if (previous && previous.sourceCity !== event.sourceCity) {
        distanceFromPreviousKm = distanceBetweenCitiesKm(previous.sourceCity, event.sourceCity);
        if (distanceFromPreviousKm !== null) {
          const minutesElapsed = (event.occurredAt.getTime() - previous.occurredAt.getTime()) / 60000;
          impliedTravelSpeedKmhValue = impliedTravelSpeedKmh(distanceFromPreviousKm, minutesElapsed);
        }
      }
      return {
        ...toStudentSignInDto(event),
        distanceFromPreviousKm: distanceFromPreviousKm !== null ? Math.round(distanceFromPreviousKm) : null,
        impliedTravelSpeedKmh: impliedTravelSpeedKmhValue !== null ? Math.round(impliedTravelSpeedKmhValue) : null,
      };
    });

    return filters.riskyOnly ? withDistance.filter((e) => riskyAlertEntityIds.has(e.id)) : withDistance;
  }

  async getCloudEvents(sessionId: string, identityId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const identity = await this.prisma.identity.findFirst({ where: { id: identityId, sessionId } });
    if (!identity) throw new AppException(404, 'NOT_FOUND', 'Identity not found.');

    const events = await this.prisma.cloudEvent.findMany({
      where: { sessionId, identityId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map(toStudentCloudEventDto);
  }
}
