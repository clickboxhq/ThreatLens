import { randomUUID } from 'crypto';
import { IncidentsService } from './incidents.service';
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
  const incidentUpdate = jest.fn(async () => incident);
  const prisma = {
    incident: {
      findFirst: jest.fn(async () => incident),
      update: incidentUpdate,
      findUniqueOrThrow: jest.fn(async () => ({
        ...incident,
        title: 'Suspicious sign-in',
        verdict: null,
        summary: null,
        alertLinks: [],
        techniqueLinks: [],
      })),
    },
    incidentTask: {
      findMany: jest.fn(async () => []),
      upsert: jest.fn(async () => ({})),
    },
    attackScenario: { findUniqueOrThrow: jest.fn(async () => ({ id: 's1' })) },
    investigationSession: {
      findUnique: jest.fn(async () => ({ id: 'session-1' })),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({
      id: 'session-1',
      status: 'active',
      scenarioId: 's1',
      scenarioVersionId: 'v1',
    })),
  };

  const service = new IncidentsService(
    prisma as never,
    sessionAccess as never,
    { record: jest.fn(async () => undefined) } as never,
    { publish: jest.fn(async () => undefined) } as never,
    { record: jest.fn(async () => undefined) } as never,
  );
  return { service, incidentUpdate };
}

// Every other write path already refused a closed incident; these two were the gap. Status is
// the one that matters most: reopening a closed incident through it would have unlocked all
// the paths that do check, so the boundary was only as strong as its least-guarded door.
describe('IncidentsService closed-incident immutability (§2.3)', () => {
  it('updateStatus() refuses to reopen a closed incident', async () => {
    const { service, incidentUpdate } = buildService('closed');

    await expect(
      service.updateStatus('session-1', 'incident-1', USER, {
        status: 'open',
      } as never),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });

    // The refusal has to happen before the write, not merely be reported after it.
    expect(incidentUpdate).not.toHaveBeenCalled();
  });

  it('updateStatus() still works on an open incident', async () => {
    const { service, incidentUpdate } = buildService('open');
    await service.updateStatus('session-1', 'incident-1', USER, {
      status: 'in_progress',
    } as never);
    expect(incidentUpdate).toHaveBeenCalled();
  });

  it('setTaskCompletion() refuses to move the checklist on a closed incident', async () => {
    // A submitted case records what the analyst concluded and how they got there; letting the
    // checklist move afterwards would rewrite that record.
    const { service } = buildService('closed');
    await expect(
      service.setTaskCompletion(
        'session-1',
        'incident-1',
        USER,
        'triage_alert',
        true,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
  });
});
