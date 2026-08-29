import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import { AppException } from '../../common/exceptions/app-exception';
import {
  StudentProcessEventDto,
  toStudentDeviceDto,
  toStudentFileEventDto,
  toStudentHttpRequestDto,
  toStudentNetworkEventDto,
  toStudentProcessEventDto,
} from '../../common/dto/device.dto';
import { deriveRiskByEntityId } from '../session-core/entity-risk';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { DeviceRiskLevel } from '@prisma/client';

export interface ProcessTreeNode extends StudentProcessEventDto {
  children: ProcessTreeNode[];
}

// §10: the Device Portal, backed by devices + process/file/network events (§6.11-§6.12).
@Injectable()
export class DevicePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
  ) {}

  async list(
    sessionId: string,
    user: AuthenticatedUser,
    filters: { riskLevel?: DeviceRiskLevel },
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const devices = await this.prisma.device.findMany({
      where: { sessionId },
      orderBy: { hostname: 'asc' },
    });

    // riskLevel is derived from open alerts rather than read off the row (see entity-risk.ts —
    // the stored column is always 'none'), so the filter has to be applied here too rather
    // than pushed into the query.
    const risk = await this.riskByDeviceId(sessionId);
    const withRisk = devices.map((device) => ({
      ...toStudentDeviceDto(device),
      riskLevel: risk.get(device.id) ?? 'none',
    }));

    return filters.riskLevel
      ? withRisk.filter((d) => d.riskLevel === filters.riskLevel)
      : withRisk;
  }

  private async riskByDeviceId(sessionId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { sessionId, primaryEntityType: 'device' },
      select: { primaryEntityId: true, severity: true, status: true },
    });
    return deriveRiskByEntityId(alerts);
  }

  async getProfile(
    sessionId: string,
    deviceId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const device = await this.getDeviceOrThrow(sessionId, deviceId);

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'view_entity',
      targetType: 'device',
      targetId: deviceId,
    });

    // Same derivation as list(), so the drawer and the table never disagree about a host.
    const risk = await this.riskByDeviceId(sessionId);
    return {
      ...toStudentDeviceDto(device),
      riskLevel: risk.get(deviceId) ?? 'none',
    };
  }

  async getProcessTree(
    sessionId: string,
    deviceId: string,
    user: AuthenticatedUser,
  ): Promise<ProcessTreeNode[]> {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getDeviceOrThrow(sessionId, deviceId);

    const events = await this.prisma.processEvent.findMany({
      where: { sessionId, deviceId },
      orderBy: { occurredAt: 'asc' },
    });

    const nodesByGuid = new Map<string, ProcessTreeNode>();
    for (const event of events) {
      nodesByGuid.set(event.processGuid, {
        ...toStudentProcessEventDto(event),
        children: [],
      });
    }

    const roots: ProcessTreeNode[] = [];
    for (const node of nodesByGuid.values()) {
      const parent = node.parentProcessGuid
        ? nodesByGuid.get(node.parentProcessGuid)
        : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async getFiles(sessionId: string, deviceId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getDeviceOrThrow(sessionId, deviceId);
    const events = await this.prisma.fileEvent.findMany({
      where: { sessionId, deviceId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map(toStudentFileEventDto);
  }

  async getNetwork(
    sessionId: string,
    deviceId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getDeviceOrThrow(sessionId, deviceId);
    const events = await this.prisma.networkEvent.findMany({
      where: { sessionId, deviceId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map(toStudentNetworkEventDto);
  }

  async getTimeline(
    sessionId: string,
    deviceId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getDeviceOrThrow(sessionId, deviceId);

    const [processes, files, network, http] = await Promise.all([
      this.prisma.processEvent.findMany({ where: { sessionId, deviceId } }),
      this.prisma.fileEvent.findMany({ where: { sessionId, deviceId } }),
      this.prisma.networkEvent.findMany({ where: { sessionId, deviceId } }),
      this.prisma.httpRequest.findMany({ where: { sessionId, deviceId } }),
    ]);

    const timeline = [
      ...processes.map((e) => ({
        entityType: 'process_event' as const,
        occurredAt: e.occurredAt,
        data: toStudentProcessEventDto(e),
      })),
      ...files.map((e) => ({
        entityType: 'file_event' as const,
        occurredAt: e.occurredAt,
        data: toStudentFileEventDto(e),
      })),
      ...network.map((e) => ({
        entityType: 'network_event' as const,
        occurredAt: e.occurredAt,
        data: toStudentNetworkEventDto(e),
      })),
      ...http.map((e) => ({
        entityType: 'http_request' as const,
        occurredAt: e.occurredAt,
        data: toStudentHttpRequestDto(e),
      })),
    ].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    return { timeline };
  }

  async getHttpRequests(
    sessionId: string,
    deviceId: string,
    user: AuthenticatedUser,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    await this.getDeviceOrThrow(sessionId, deviceId);
    const events = await this.prisma.httpRequest.findMany({
      where: { sessionId, deviceId },
      orderBy: { occurredAt: 'asc' },
    });
    return events.map(toStudentHttpRequestDto);
  }

  /** §2.20, §10.11: mutates device.isolationStatus within the same transaction as the action record. */
  async isolate(sessionId: string, deviceId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const device = await this.getDeviceOrThrow(sessionId, deviceId);

    if (device.isolationStatus === 'isolated') {
      return toStudentDeviceDto(device);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: deviceId },
        data: { isolationStatus: 'isolated' },
      }),
      this.prisma.investigationAction.create({
        data: {
          sessionId,
          userId: user.id,
          actionType: 'isolate_device',
          targetType: 'device',
          targetId: deviceId,
        },
      }),
    ]);

    return toStudentDeviceDto(updated);
  }

  private async getDeviceOrThrow(sessionId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, sessionId },
    });
    if (!device) throw new AppException(404, 'NOT_FOUND', 'Device not found.');
    return device;
  }
}
