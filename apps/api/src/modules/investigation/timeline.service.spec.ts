import { randomUUID } from 'crypto';
import { TimelineService } from './timeline.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = { id: randomUUID(), role: 'student' } as AuthenticatedUser;

function buildService(incidentStatus: string) {
  const incident = { id: 'incident-1', sessionId: 'session-1', status: incidentStatus };
  const prisma = {
    incident: { findFirst: jest.fn(async () => incident) },
    timelineItem: {
      upsert: jest.fn(async (args: { create: unknown }) => args.create),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const sessionAccess = { getOwnedSession: jest.fn(async () => ({ id: 'session-1' })) };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new TimelineService(prisma as never, sessionAccess as never, investigationActions as never);
  return { service };
}

// Same rationale as evidence-notes.service.spec.ts — §2.3's immutability guarantee, applied to
// the timeline's own two mutating endpoints (§16.7).
describe('TimelineService closed-incident immutability (§2.3)', () => {
  it('addToTimeline() rejects with 409 INCIDENT_CLOSED on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.addToTimeline('session-1', 'incident-1', USER, { eventTable: 'sign_in_events', eventId: 'e1' }),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
  });

  it('removeFromTimeline() rejects on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(service.removeFromTimeline('session-1', 'incident-1', 'sign_in_events', 'e1', USER)).rejects.toMatchObject({
      status: 409,
      code: 'INCIDENT_CLOSED',
    });
  });

  it('addToTimeline() succeeds on an open incident', async () => {
    const { service } = buildService('open');
    await expect(
      service.addToTimeline('session-1', 'incident-1', USER, { eventTable: 'sign_in_events', eventId: 'e1' }),
    ).resolves.toBeTruthy();
  });
});
