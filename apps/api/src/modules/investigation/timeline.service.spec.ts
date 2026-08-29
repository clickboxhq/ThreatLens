import { randomUUID } from 'crypto';
import { TimelineService } from './timeline.service';
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
      signInEvent: { findUnique: jest.fn() },
    };
    const sessionAccess = { getOwnedSession: jest.fn() };
    const investigationActions = { record: jest.fn() };
    const service = new TimelineService(
      prisma as never,
      sessionAccess as never,
      investigationActions as never,
    );
    return { service, prisma };
  }

  it('returns [] when the Student has no incidents at all', async () => {
    const { service } = buildServiceWithIncidents([]);
    await expect(service.listMine(USER)).resolves.toEqual([]);
  });

  it('merges evidence + manual items across two different incidents and never links their correlation ids together', async () => {
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
    // Both incidents' events happen to share the same correlation_id string — a coincidence
    // that must NOT show up as a cross-incident correlation line.
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
