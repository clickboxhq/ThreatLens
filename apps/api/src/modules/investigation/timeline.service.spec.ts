import { randomUUID } from 'crypto';
import { relatedByEscalatedAlerts, TimelineService } from './timeline.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

function buildService(incidentStatus: string) {
  const incident = {
    id: 'incident-1',
    sessionId: 'session-1',
    status: incidentStatus,
  };
  const prisma = {
    incident: { findFirst: jest.fn(async () => incident) },
    timelineItem: {
      upsert: jest.fn(async (args: { create: unknown }) => args.create),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({ id: 'session-1' })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new TimelineService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
    { assertEventInSession: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service };
}

// Same rationale as evidence-notes.service.spec.ts — §2.3's immutability guarantee, applied to
// the timeline's own two mutating endpoints (§16.7).
describe('TimelineService closed-incident immutability (§2.3)', () => {
  it('addToTimeline() rejects with 409 INCIDENT_CLOSED on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.addToTimeline('session-1', 'incident-1', USER, {
        eventTable: 'sign_in_events',
        eventId: 'e1',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
  });

  it('removeFromTimeline() rejects on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.removeFromTimeline(
        'session-1',
        'incident-1',
        'sign_in_events',
        'e1',
        USER,
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'INCIDENT_CLOSED',
    });
  });

  it('addToTimeline() succeeds on an open incident', async () => {
    const { service } = buildService('open');
    await expect(
      service.addToTimeline('session-1', 'incident-1', USER, {
        eventTable: 'sign_in_events',
        eventId: 'e1',
      }),
    ).resolves.toBeTruthy();
  });
});

// §2.9's Global Timeline aggregate — merges evidence + manually-added items across every
// incident the Student has ever worked, not just one.
describe('TimelineService.listMine', () => {
  function buildServiceWithIncidents(incidents: unknown[]) {
    const prisma = {
      incident: { findMany: jest.fn(async () => incidents) },
      evidenceCollection: { findMany: jest.fn(async () => []) },
      timelineItem: { findMany: jest.fn(async () => []) },
      incidentAlert: { findMany: jest.fn(async () => []) },
      alertEvidenceRef: { findMany: jest.fn(async () => []) },
      signInEvent: { findUnique: jest.fn() },
    };
    const sessionAccess = { getOwnedSession: jest.fn() };
    const investigationActions = { record: jest.fn() };
    const service = new TimelineService(
      prisma as never,
      sessionAccess as never,
      investigationActions as never,
      { assertEventInSession: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, prisma };
  }

  it('returns [] when the Student has no incidents at all', async () => {
    const { service } = buildServiceWithIncidents([]);
    await expect(service.listMine(USER)).resolves.toEqual([]);
  });

  it('merges evidence + manual items across two different incidents and never relates them to each other', async () => {
    const incidentA = {
      id: 'incident-a',
      sessionId: 'session-a',
      title: 'Case A',
      session: { scenario: { title: 'Impossible Travel' } },
    };
    const incidentB = {
      id: 'incident-b',
      sessionId: 'session-b',
      title: 'Case B',
      session: { scenario: { title: 'Password Spraying' } },
    };
    const { service, prisma } = buildServiceWithIncidents([
      incidentA,
      incidentB,
    ]);

    prisma.evidenceCollection.findMany.mockImplementation(async () => [
      { incidentId: 'incident-a', eventTable: 'sign_in_events', eventId: 'e1' },
    ]);
    prisma.timelineItem.findMany.mockImplementation(async () => [
      { incidentId: 'incident-b', eventTable: 'sign_in_events', eventId: 'e2' },
    ]);
    // Nothing has been escalated in either incident, so nothing is related — and the raw
    // correlation_id both events happen to carry must play no part in that.
    prisma.signInEvent.findUnique.mockImplementation(
      async (args: { where: { id: string } }) => {
        const base = {
          sourceCity: 'Lagos',
          sourceCountry: 'NG',
          result: 'success',
          correlationId: 'shared-corr-id',
          identity: { id: 'identity-1', displayName: 'Jane Doe' },
        };
        return args.where.id === 'e1'
          ? {
              ...base,
              occurredAt: new Date('2026-08-01T00:00:00Z'),
              identityId: 'identity-1',
            }
          : {
              ...base,
              occurredAt: new Date('2026-08-02T00:00:00Z'),
              identityId: 'identity-1',
            };
      },
    );

    const result = await service.listMine(USER);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.incidentTitle)).toEqual(['Case A', 'Case B']);
    expect(result.find((r) => r.id === 'e1')!.relatedItemIds).toEqual([]);
    expect(result.find((r) => r.id === 'e2')!.relatedItemIds).toEqual([]);
  });
});

// relatedItemIds is now the student's own correlation: two timeline items are related when
// both are cited by alerts they escalated into the same incident. The graph draws what they
// connected, and only that.
describe('relatedByEscalatedAlerts', () => {
  const item = (eventId: string, scope = 'inc-1') => ({ eventId, scope });

  it('relates two items cited by the same escalated alert', () => {
    const a = item('e1');
    const b = item('e2');
    const related = relatedByEscalatedAlerts(
      [a, b],
      [{ scope: 'inc-1', alertId: 'alert-x' }],
      [
        { alertId: 'alert-x', eventId: 'e1' },
        { alertId: 'alert-x', eventId: 'e2' },
      ],
    );
    expect(related.get(a)).toEqual(['e2']);
    expect(related.get(b)).toEqual(['e1']);
  });

  it('relates nothing through an alert that was never escalated', () => {
    const a = item('e1');
    const b = item('e2');
    const related = relatedByEscalatedAlerts(
      [a, b],
      [],
      [
        { alertId: 'alert-x', eventId: 'e1' },
        { alertId: 'alert-x', eventId: 'e2' },
      ],
    );
    expect(related.get(a)).toEqual([]);
    expect(related.get(b)).toEqual([]);
  });

  it('keeps incidents apart: an alert escalated in one says nothing about another', () => {
    const a = item('e1', 'inc-1');
    const b = item('e2', 'inc-2');
    const related = relatedByEscalatedAlerts(
      [a, b],
      [{ scope: 'inc-1', alertId: 'alert-x' }],
      [
        { alertId: 'alert-x', eventId: 'e1' },
        { alertId: 'alert-x', eventId: 'e2' },
      ],
    );
    expect(related.get(a)).toEqual([]);
    expect(related.get(b)).toEqual([]);
  });

  it('bridges items across two escalated alerts that share an event', () => {
    // Alert X cites e1+e2, alert Y cites e2+e3: e2 is related to both, e1 and e3 only to e2.
    const [a, b, c] = [item('e1'), item('e2'), item('e3')];
    const related = relatedByEscalatedAlerts(
      [a, b, c],
      [
        { scope: 'inc-1', alertId: 'x' },
        { scope: 'inc-1', alertId: 'y' },
      ],
      [
        { alertId: 'x', eventId: 'e1' },
        { alertId: 'x', eventId: 'e2' },
        { alertId: 'y', eventId: 'e2' },
        { alertId: 'y', eventId: 'e3' },
      ],
    );
    expect(related.get(a)).toEqual(['e2']);
    expect(related.get(b)!.sort()).toEqual(['e1', 'e3']);
    expect(related.get(c)).toEqual(['e2']);
  });
});
