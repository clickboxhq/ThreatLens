import { randomUUID } from 'crypto';
import { EvidenceNotesService } from './evidence-notes.service';
import { AppException } from '../../common/exceptions/app-exception';
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
    evidenceCollection: {
      create: jest.fn(async (args: { data: unknown }) => args.data),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    analystNote: {
      create: jest.fn(async (args: { data: unknown }) => args.data),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({ id: 'session-1' })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new EvidenceNotesService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
  );
  return { service, investigationActions };
}

// §2.3's acceptance criterion: "Case status and verdict are immutable once submitted except via
// an explicit, audited instructor reopen action" — these tests guard the mutation-blocking half
// of that, which is the direct prerequisite for the Incident Report (§2.14) being meaningfully final.
describe('EvidenceNotesService closed-incident immutability (§2.3)', () => {
  it('pinEvidence() rejects with 409 INCIDENT_CLOSED on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.pinEvidence('session-1', 'incident-1', USER, {
        eventTable: 'sign_in_events',
        eventId: 'e1',
        justification: 'because',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
  });

  it('removeEvidence() rejects on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.removeEvidence('session-1', 'incident-1', 'ev-1', USER),
    ).rejects.toMatchObject({
      status: 409,
      code: 'INCIDENT_CLOSED',
    });
  });

  it('createNote() rejects on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.createNote('session-1', 'incident-1', USER, { body: 'a note' }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('pinEvidence() succeeds on an open incident', async () => {
    const { service } = buildService('open');
    await expect(
      service.pinEvidence('session-1', 'incident-1', USER, {
        eventTable: 'sign_in_events',
        eventId: 'e1',
        justification: 'because',
      }),
    ).resolves.toBeTruthy();
  });

  it('createNote() succeeds on an open incident', async () => {
    const { service } = buildService('open');
    await expect(
      service.createNote('session-1', 'incident-1', USER, { body: 'a note' }),
    ).resolves.toBeTruthy();
  });

  it('logResponseAction() rejects on a closed incident', async () => {
    const { service } = buildService('closed');
    await expect(
      service.logResponseAction('session-1', 'incident-1', USER, {
        actionType: 'isolate_device',
        targetType: 'device',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'INCIDENT_CLOSED' });
  });
});

// The ThreatLens "Response actions" panel has no entity picker (a flat button list — see
// LogResponseActionDto's own comment), so this only ever records the audit-trail row, never a
// specific device/identity/email's state.
describe('EvidenceNotesService.logResponseAction (response-action panel wiring)', () => {
  it('records an InvestigationAction row keyed to the incident itself, for each of the 6 response-action types', async () => {
    const { service, investigationActions } = buildService('open');

    for (const actionType of [
      'isolate_device',
      'disable_account',
      'force_password_reset',
      'revoke_tokens',
      'block_sender',
      'block_ip',
    ] as const) {
      await service.logResponseAction('session-1', 'incident-1', USER, {
        actionType,
        targetType: 'device',
      });
    }

    expect(investigationActions.record).toHaveBeenCalledTimes(6);
    expect(investigationActions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        incidentId: 'incident-1',
        userId: USER.id,
        actionType: 'block_ip',
        targetType: 'device',
        targetId: 'incident-1',
      }),
    );
  });
});

// The evidence endpoint only ever carried a raw (eventTable, eventId) pointer, not enough for
// a UI to render without a second lookup per row (the same problem TimelineService.getTimeline
// already solved with resolveFact) — listEvidence now resolves a display title/summary itself.
describe('EvidenceNotesService.listEvidence display enrichment', () => {
  function buildServiceWithEvents() {
    const prisma = {
      incident: {
        findFirst: jest.fn(async () => ({
          id: 'incident-1',
          sessionId: 'session-1',
          status: 'open',
        })),
      },
      evidenceCollection: {
        findMany: jest.fn(async () => [
          {
            id: 'ev-1',
            incidentId: 'incident-1',
            eventTable: 'sign_in_events',
            eventId: 'sign-in-1',
            justification: 'because',
            mitreTechniqueId: null,
            pinnedBy: USER.id,
            pinnedAt: new Date(),
          },
          {
            id: 'ev-2',
            incidentId: 'incident-1',
            eventTable: 'unsupported_table',
            eventId: 'x',
            justification: 'because',
            mitreTechniqueId: null,
            pinnedBy: USER.id,
            pinnedAt: new Date(),
          },
        ]),
      },
      signInEvent: {
        findUnique: jest.fn(async () => ({
          id: 'sign-in-1',
          sourceCity: 'Lagos',
          sourceCountry: 'NG',
          result: 'success',
          identity: { displayName: 'Jane Doe' },
        })),
      },
    };
    const sessionAccess = {
      getOwnedSession: jest.fn(async () => ({ id: 'session-1' })),
    };
    const investigationActions = { record: jest.fn(async () => undefined) };
    const service = new EvidenceNotesService(
      prisma as never,
      sessionAccess as never,
      investigationActions as never,
    );
    return { service };
  }

  it('resolves a title/summary for a supported eventTable, and null for one it does not recognize', async () => {
    const { service } = buildServiceWithEvents();
    const evidence = await service.listEvidence(
      'session-1',
      'incident-1',
      USER,
    );

    expect(evidence).toHaveLength(2);
    expect(evidence[0].display).toEqual({
      title: 'Sign-in: Jane Doe',
      summary: 'From Lagos, NG (success)',
    });
    expect(evidence[1].display).toBeNull();
  });
});

// §2.10's Evidence Locker aggregate — every artifact pinned across every incident the Student
// has ever worked, scoped to their own sessions via the incident->session->userId join.
describe('EvidenceNotesService.listMine', () => {
  it('returns [] when the Student has pinned nothing', async () => {
    const prisma = {
      evidenceCollection: { findMany: jest.fn(async () => []) },
    };
    const service = new EvidenceNotesService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(service.listMine(USER)).resolves.toEqual([]);
  });

  it('joins incident/session/scenario context and resolves each technique + display', async () => {
    const prisma = {
      evidenceCollection: {
        findMany: jest.fn(async () => [
          {
            id: 'ev-1',
            incidentId: 'incident-1',
            eventTable: 'sign_in_events',
            eventId: 'sign-in-1',
            justification: 'because',
            mitreTechniqueId: 'technique-uuid-1',
            pinnedAt: new Date('2026-08-01T00:00:00Z'),
            incident: {
              sessionId: 'session-1',
              title: 'Case A',
              session: { scenario: { title: 'Impossible Travel' } },
            },
          },
        ]),
      },
      mitreTechnique: {
        findMany: jest.fn(async () => [
          {
            id: 'technique-uuid-1',
            techniqueId: 'T1078',
            name: 'Valid Accounts',
          },
        ]),
      },
      signInEvent: {
        findUnique: jest.fn(async () => ({
          sourceCity: 'Lagos',
          sourceCountry: 'NG',
          result: 'success',
          identity: { displayName: 'Jane Doe' },
        })),
      },
    };
    const service = new EvidenceNotesService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.listMine(USER);

    expect(result).toEqual([
      {
        id: 'ev-1',
        sessionId: 'session-1',
        scenarioTitle: 'Impossible Travel',
        incidentId: 'incident-1',
        incidentTitle: 'Case A',
        eventTable: 'sign_in_events',
        justification: 'because',
        mitreTechnique: { techniqueId: 'T1078', name: 'Valid Accounts' },
        pinnedAt: new Date('2026-08-01T00:00:00Z'),
        display: {
          title: 'Sign-in: Jane Doe',
          summary: 'From Lagos, NG (success)',
        },
      },
    ]);
  });
});
