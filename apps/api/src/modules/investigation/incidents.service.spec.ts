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
    alert: {
      findFirst: jest.fn(async () => ({
        id: 'alert-1',
        sessionId: 'session-1',
        status: 'in_progress',
      })),
      update: jest.fn(async () => ({})),
    },
    incidentAlert: {
      deleteMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
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

  const investigationActions = { record: jest.fn(async () => undefined) };
  const service = new IncidentsService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
    { publish: jest.fn(async () => undefined) } as never,
    { record: jest.fn(async () => undefined) } as never,
  );
  return { service, incidentUpdate, prisma, investigationActions };
}

// Triage is the one decision a student makes about an alert that they are allowed to change
// their mind on before submitting — so escalation has to be reversible, and reversing it has
// to leave the alert looking the way it did before, not stranded in_progress.
describe('IncidentsService.unlinkAlert', () => {
  it('removes the link and returns the alert to the queue when nothing else claims it', async () => {
    const { service, prisma, investigationActions } = buildService('open');

    await service.unlinkAlert('session-1', 'incident-1', USER, 'alert-1');

    expect(prisma.incidentAlert.deleteMany).toHaveBeenCalledWith({
      where: { incidentId: 'incident-1', alertId: 'alert-1' },
    });
    expect(prisma.alert.update).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { status: 'new' },
    });
    expect(investigationActions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'escalate_to_incident',
        metadata: { unlinkedAlertId: 'alert-1' },
      }),
    );
  });

  it('leaves the alert in_progress when another incident still links it', async () => {
    const { service, prisma } = buildService('open');
    prisma.incidentAlert.count.mockResolvedValueOnce(1);

    await service.unlinkAlert('session-1', 'incident-1', USER, 'alert-1');

    expect(prisma.alert.update).not.toHaveBeenCalled();
  });

  it('does not touch an alert that was already back in the queue', async () => {
    const { service, prisma } = buildService('open');
    prisma.alert.findFirst.mockResolvedValueOnce({
      id: 'alert-1',
      sessionId: 'session-1',
      status: 'dismissed',
    });

    await service.unlinkAlert('session-1', 'incident-1', USER, 'alert-1');

    expect(prisma.alert.update).not.toHaveBeenCalled();
  });

  it('refuses on a closed incident — its links are what the score was computed from', async () => {
    const { service, prisma } = buildService('closed');
    await expect(
      service.unlinkAlert('session-1', 'incident-1', USER, 'alert-1'),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
    expect(prisma.incidentAlert.deleteMany).not.toHaveBeenCalled();
  });

  it('404s on an alert from another session rather than unlinking by id alone', async () => {
    const { service, prisma } = buildService('open');
    prisma.alert.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.unlinkAlert('session-1', 'incident-1', USER, 'alert-1'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

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
