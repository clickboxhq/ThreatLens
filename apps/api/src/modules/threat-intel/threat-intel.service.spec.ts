import { randomUUID } from 'crypto';
import { ThreatIntelService } from './threat-intel.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

function buildService(
  overrides: {
    indicator?: unknown;
    actions?: unknown[];
    indicators?: unknown[];
  } = {},
) {
  const prisma = {
    threatIntelIndicator: {
      findFirst: jest.fn(async () => overrides.indicator ?? null),
      findMany: jest.fn(async () => overrides.indicators ?? []),
    },
    investigationAction: {
      findMany: jest.fn(async () => overrides.actions ?? []),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({
      id: 'session-1',
      scenarioVersionId: 'version-1',
    })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new ThreatIntelService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
  );
  return { service, prisma, investigationActions };
}

// §2.7's ground-truth boundary: a lookup only ever answers the one (type, value) the Student
// already has, and a match is the only case that gets remembered — a miss records nothing, so
// there's no way to build up "things this scenario doesn't have" from repeated lookups.
describe('ThreatIntelService.lookup ground-truth boundary', () => {
  it('returns reputation "unknown" and records nothing on a miss', async () => {
    const { service, investigationActions } = buildService({ indicator: null });
    const result = await service.lookup('session-1', USER, 'ip', '1.2.3.4');

    expect(result).toEqual({
      value: '1.2.3.4',
      type: 'ip',
      reputation: 'unknown',
      actorAttribution: null,
      context: null,
    });
    expect(investigationActions.record).not.toHaveBeenCalled();
  });

  it('records a view_threat_intel action keyed to the indicator on a real match', async () => {
    const indicator = {
      id: 'indicator-1',
      value: '1.2.3.4',
      indicatorType: 'ip',
      reputation: 'malicious',
      actorAttribution: 'APT-Fake',
      context: 'C2 server',
    };
    const { service, investigationActions } = buildService({ indicator });
    const result = await service.lookup('session-1', USER, 'ip', '1.2.3.4');

    expect(result.reputation).toBe('malicious');
    expect(investigationActions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: USER.id,
        actionType: 'view_threat_intel',
        targetType: 'threat_intel_indicator',
        targetId: 'indicator-1',
      }),
    );
  });
});

describe('ThreatIntelService.listMine', () => {
  it('returns empty indicators/actors when the Student has never looked anything up', async () => {
    const { service } = buildService({ actions: [] });
    await expect(service.listMine(USER)).resolves.toEqual({
      indicators: [],
      actors: [],
    });
  });

  it('aggregates real lookups into indicators and a per-actor rollup, using the worst reputation seen', async () => {
    const occurredAt1 = new Date('2026-08-01T00:00:00Z');
    const occurredAt2 = new Date('2026-08-02T00:00:00Z');
    const { service } = buildService({
      actions: [
        {
          id: 'action-1',
          targetId: 'indicator-1',
          occurredAt: occurredAt1,
          session: { scenario: { title: 'Impossible Travel' } },
        },
        {
          id: 'action-2',
          targetId: 'indicator-2',
          occurredAt: occurredAt2,
          session: { scenario: { title: 'BEC Wire Fraud' } },
        },
      ],
      indicators: [
        {
          id: 'indicator-1',
          value: '1.2.3.4',
          indicatorType: 'ip',
          reputation: 'suspicious',
          actorAttribution: 'APT-Fake',
          context: 'Suspicious relay',
        },
        {
          id: 'indicator-2',
          value: 'evil.example',
          indicatorType: 'domain',
          reputation: 'malicious',
          actorAttribution: 'APT-Fake',
          context: 'Known C2 domain',
        },
      ],
    });

    const result = await service.listMine(USER);

    expect(result.indicators).toHaveLength(2);
    expect(result.indicators[0]).toMatchObject({
      value: '1.2.3.4',
      scenarioTitle: 'Impossible Travel',
      lookedUpAt: occurredAt1,
    });
    expect(result.actors).toEqual([
      {
        name: 'APT-Fake',
        indicatorCount: 2,
        campaigns: 2,
        reputation: 'malicious',
      },
    ]);
  });

  it('skips an action whose indicator row no longer resolves', async () => {
    const { service } = buildService({
      actions: [
        {
          id: 'action-1',
          targetId: 'missing-indicator',
          occurredAt: new Date(),
          session: { scenario: { title: 'Impossible Travel' } },
        },
      ],
      indicators: [],
    });

    const result = await service.listMine(USER);
    expect(result.indicators).toEqual([]);
    expect(result.actors).toEqual([]);
  });
});
