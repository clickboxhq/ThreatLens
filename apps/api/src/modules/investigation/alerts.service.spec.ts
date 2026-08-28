import { randomUUID } from 'crypto';
import { AlertsService } from './alerts.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

function buildAlert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'alert-1',
    sessionId: 'session-1',
    title: 'Impossible travel',
    description: 'desc',
    severity: 'critical',
    status: 'new',
    dismissalReason: null,
    primaryEntityType: 'identity',
    primaryEntityId: 'identity-1',
    mitreTechnique: null,
    relatedAlertId: null,
    dedupCount: 1,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    ...overrides,
  };
}

function buildService(alerts: ReturnType<typeof buildAlert>[]) {
  const prisma = {
    alert: {
      findMany: jest.fn(async () => alerts),
      findFirst: jest.fn(async () => alerts[0]),
      update: jest.fn(async (args: { data: unknown }) => ({
        ...alerts[0],
        ...(args.data as Record<string, unknown>),
      })),
    },
    identity: { findMany: jest.fn(async () => []) },
    device: { findMany: jest.fn(async () => []) },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({ id: 'session-1' })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };
  const realtimeEvents = { publish: jest.fn(async () => undefined) };

  const service = new AlertsService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
    realtimeEvents as never,
  );
  return { service, prisma };
}

// The alert list is a triage queue — "who/what is this about" has to read at a glance, so
// list() resolves each alert's primaryEntityType/primaryEntityId into a display name rather
// than leaving the client to fetch each entity individually.
describe('AlertsService entity display resolution', () => {
  it('resolves an identity-type alert to the identity displayName', async () => {
    const alert = buildAlert({
      primaryEntityType: 'identity',
      primaryEntityId: 'identity-1',
    });
    const { service, prisma } = buildService([alert]);
    prisma.identity.findMany.mockResolvedValueOnce([
      { id: 'identity-1', displayName: 'Jamie Brown' },
    ]);

    const result = await service.list('session-1', USER, {});

    expect(result[0].entityDisplay).toBe('Jamie Brown');
    expect(prisma.identity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['identity-1'] } } }),
    );
  });

  it('resolves a mailbox-type alert through the identity lookup (mailbox has no own table)', async () => {
    const alert = buildAlert({
      primaryEntityType: 'mailbox',
      primaryEntityId: 'identity-2',
    });
    const { service, prisma } = buildService([alert]);
    prisma.identity.findMany.mockResolvedValueOnce([
      { id: 'identity-2', displayName: 'Sarah Chen' },
    ]);

    const result = await service.list('session-1', USER, {});

    expect(result[0].entityDisplay).toBe('Sarah Chen');
    expect(prisma.device.findMany).not.toHaveBeenCalled();
  });

  it('resolves a device-type alert to the device hostname', async () => {
    const alert = buildAlert({
      primaryEntityType: 'device',
      primaryEntityId: 'device-1',
    });
    const { service, prisma } = buildService([alert]);
    prisma.device.findMany.mockResolvedValueOnce([
      { id: 'device-1', hostname: 'SRV-DB-07' },
    ]);

    const result = await service.list('session-1', USER, {});

    expect(result[0].entityDisplay).toBe('SRV-DB-07');
  });

  it('returns entityDisplay: null when the entity lookup misses, and skips queries on an empty list', async () => {
    const { service, prisma } = buildService([]);

    const result = await service.list('session-1', USER, {});

    expect(result).toEqual([]);
    expect(prisma.identity.findMany).not.toHaveBeenCalled();
    expect(prisma.device.findMany).not.toHaveBeenCalled();
  });

  it("carries entityDisplay through updateStatus()'s response too", async () => {
    const alert = buildAlert({
      primaryEntityType: 'device',
      primaryEntityId: 'device-1',
    });
    const { service, prisma } = buildService([alert]);
    prisma.device.findMany.mockResolvedValueOnce([
      { id: 'device-1', hostname: 'FIN-DESK-22' },
    ]);

    const result = await service.updateStatus('session-1', 'alert-1', USER, {
      status: 'in_progress',
    } as never);

    expect(result.entityDisplay).toBe('FIN-DESK-22');
  });
});
