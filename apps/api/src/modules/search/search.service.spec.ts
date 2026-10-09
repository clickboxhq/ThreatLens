import { randomUUID } from 'crypto';
import { SearchService } from './search.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

const SESSION_ID = 'session-1';

function findManyMock<T>(rows: T[]) {
  const fn = jest.fn<Promise<T[]>, [Record<string, unknown>]>();
  fn.mockResolvedValue(rows);
  return fn;
}

function buildService() {
  const prisma = {
    signInEvent: { findMany: findManyMock([]) },
    emailMessage: { findMany: findManyMock([]) },
    cloudEvent: { findMany: findManyMock([]) },
    processEvent: { findMany: findManyMock([]) },
    fileEvent: { findMany: findManyMock([]) },
    networkEvent: { findMany: findManyMock([]) },
    httpRequest: { findMany: findManyMock([]) },
    investigationSession: { findMany: findManyMock([]) },
    // Recipient addresses are a String[]; Prisma's array filters only compare whole elements,
    // so partial matching goes through one raw query.
    $queryRaw: jest.fn(async () => [] as Array<{ id: string }>),
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({ id: SESSION_ID })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new SearchService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
  );
  return { service, prisma, investigationActions };
}

// §2.8/§16.12: extended from sign-ins + email only to also cover cloud, process, file,
// network, and http-request telemetry — the tests below guard the field-routing logic that
// decides which of the 7 tables a given filter/freetext actually queries.
describe('SearchService (§2.8, §16.12)', () => {
  it('with no filters and no freetext, queries all 7 entity types ("browse everything")', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, []);

    expect(prisma.signInEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.emailMessage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.cloudEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.processEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.fileEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.networkEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.httpRequest.findMany).toHaveBeenCalledTimes(1);
  });

  it('a sign-in-only filter (sourceCountry) does not query email/cloud/device tables', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [
      { field: 'sourceCountry', value: 'RU' },
    ]);

    expect(prisma.signInEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.emailMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.cloudEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.processEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.fileEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.networkEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.httpRequest.findMany).not.toHaveBeenCalled();
  });

  it('a field shared across entity types (sourceIp) queries every table that has it', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [
      { field: 'sourceIp', value: '1.2.3.4' },
    ]);

    // sourceIp exists on sign-in, cloud, and http-request — network's equivalent field is
    // named remoteIp, not sourceIp, so it correctly stays excluded here.
    expect(prisma.signInEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.cloudEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.httpRequest.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.emailMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.processEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.fileEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.networkEvent.findMany).not.toHaveBeenCalled();

    const cloudArgs = prisma.cloudEvent.findMany.mock.calls[0]?.[0] as {
      where: { sourceIp: unknown };
    };
    expect(cloudArgs.where.sourceIp).toEqual({
      equals: '1.2.3.4',
      mode: 'insensitive',
    });
  });

  it('freetext queries email, cloud, process, file, and http (not sign-in or network)', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [], 'powershell');

    expect(prisma.emailMessage.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.cloudEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.processEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.fileEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.httpRequest.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.signInEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.networkEvent.findMany).not.toHaveBeenCalled();

    const processArgs = prisma.processEvent.findMany.mock.calls[0]?.[0] as {
      where: { OR: unknown };
    };
    expect(processArgs.where.OR).toEqual([
      { imagePath: { contains: 'powershell', mode: 'insensitive' } },
      { commandLine: { contains: 'powershell', mode: 'insensitive' } },
    ]);
  });

  it('a network-only filter (remoteIp) queries only network events, even with no other filters set', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [
      { field: 'remoteIp', value: '10.0.0.1' },
    ]);

    expect(prisma.networkEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.signInEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.emailMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.cloudEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.processEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.fileEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.httpRequest.findMany).not.toHaveBeenCalled();
  });

  it('merges results from multiple entity types sorted newest-first, and records the search action once', async () => {
    const { service, prisma, investigationActions } = buildService();
    prisma.signInEvent.findMany = findManyMock([
      {
        id: 's1',
        occurredAt: new Date('2026-01-01T00:00:00Z'),
        identityId: 'i1',
        deviceId: null,
        sourceIp: '1.1.1.1',
        sourceCountry: 'US',
        sourceCity: 'NYC',
        application: 'Outlook',
        result: 'success',
        failureReason: null,
        isLegacyAuth: false,
        clientApp: 'modern',
      },
    ]) as never;
    prisma.processEvent.findMany = findManyMock([
      {
        id: 'p1',
        occurredAt: new Date('2026-01-02T00:00:00Z'),
        sessionId: SESSION_ID,
        deviceId: 'd1',
        processGuid: 'g1',
        parentProcessGuid: null,
        imagePath: 'C:\\evil.exe',
        commandLine: 'evil.exe -x',
        hashSha256: 'abc',
        parentImagePath: null,
        integrityLevel: 'high',
        identityId: null,
        isGroundTruthEvidence: false,
        mitreTechniqueId: null,
        correlationId: null,
        raw: {},
      },
    ]) as never;

    const result = await service.search(SESSION_ID, USER, []);

    expect(result.results.map((r) => r.entityType)).toEqual([
      'process_event',
      'sign_in_event',
    ]);
    expect(investigationActions.record).toHaveBeenCalledTimes(1);
    expect(investigationActions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        userId: USER.id,
        actionType: 'search',
      }),
    );
  });

  // §12.3: an event's own mitreTechniqueId tag is the answer key. ThreatLens's inherited
  // search-box placeholder implies a `mitre=T1528` filter (from a system with no ground-truth
  // boundary at all) — a `mitre`/`mitreTechniqueId` filter must be silently a no-op here, not
  // wired to any table, so it can never be used to fish for ground-truth-tagged evidence.
  it('a mitre/mitreTechniqueId filter is a no-op — matches no entity type at all', async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [
      { field: 'mitreTechniqueId', value: 'T1528' },
    ]);
    await service.search(SESSION_ID, USER, [
      { field: 'mitre', value: 'T1528' },
    ]);

    for (const table of [
      prisma.signInEvent,
      prisma.emailMessage,
      prisma.cloudEvent,
      prisma.processEvent,
      prisma.fileEvent,
      prisma.networkEvent,
      prisma.httpRequest,
    ]) {
      expect(table.findMany).not.toHaveBeenCalled();
    }
  });
});

// §2.8's "Global Search" — same query, scoped to every session the Student owns.
describe('SearchService.searchMine', () => {
  it('returns [] without querying any telemetry table when the Student has no sessions', async () => {
    const { service, prisma } = buildService();
    const result = await service.searchMine(USER, []);

    expect(result).toEqual({ results: [] });
    expect(prisma.signInEvent.findMany).not.toHaveBeenCalled();
  });

  it("queries across every owned session and attaches each result's scenario title", async () => {
    const { service, prisma } = buildService();
    prisma.investigationSession.findMany = findManyMock([
      { id: 'session-a', scenario: { title: 'Impossible Travel' } },
      { id: 'session-b', scenario: { title: 'Password Spraying' } },
    ]) as never;
    prisma.signInEvent.findMany = findManyMock([
      {
        id: 's1',
        sessionId: 'session-a',
        occurredAt: new Date('2026-01-01T00:00:00Z'),
        identityId: 'i1',
        deviceId: null,
        sourceIp: '1.1.1.1',
        sourceCountry: 'US',
        sourceCity: 'NYC',
        application: 'Outlook',
        result: 'success',
        failureReason: null,
        isLegacyAuth: false,
        clientApp: 'modern',
      },
      {
        id: 's2',
        sessionId: 'session-b',
        occurredAt: new Date('2026-01-02T00:00:00Z'),
        identityId: 'i2',
        deviceId: null,
        sourceIp: '2.2.2.2',
        sourceCountry: 'RU',
        sourceCity: 'Moscow',
        application: 'Outlook',
        result: 'success',
        failureReason: null,
        isLegacyAuth: false,
        clientApp: 'modern',
      },
    ]) as never;

    const result = await service.searchMine(USER, []);

    expect(prisma.signInEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionId: { in: ['session-a', 'session-b'] },
        }),
      }),
    );
    expect(
      result.results.map((r) => (r as { scenarioTitle: string }).scenarioTitle),
    ).toEqual(['Password Spraying', 'Impossible Travel']);
  });

  it('does not record an InvestigationAction (no single session to attribute it to)', async () => {
    const { service, prisma, investigationActions } = buildService();
    prisma.investigationSession.findMany = findManyMock([
      { id: 'session-a', scenario: { title: 'Impossible Travel' } },
    ]) as never;

    await service.searchMine(USER, []);
    expect(investigationActions.record).not.toHaveBeenCalled();
  });

  // Reported from a live session: searching a recipient's name returned nothing while the
  // email was plainly on screen, addressed to them. Every other party to a message was
  // searchable — sender address, subject, body — but not the person it was sent to.
  it('finds an email by its recipient, not just its sender', async () => {
    const { service, prisma } = buildService();
    prisma.$queryRaw = jest.fn(async () => [{ id: 'email-7' }]);

    await service.search(SESSION_ID, USER, [], 'emma');

    const args = prisma.emailMessage.findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(args.where.OR).toContainEqual({ id: { in: ['email-7'] } });
  });

  it('scopes the recipient lookup to the session rather than relying on the outer filter', async () => {
    // The ids feed a clause that sits beside sessionId, so the outer filter would hide
    // another session's rows anyway. Isolation should not depend on that: it is the one
    // property this search cannot afford to get wrong by accident.
    const { service, prisma } = buildService();
    prisma.$queryRaw = jest.fn(async () => []);

    await service.search(SESSION_ID, USER, [], 'emma');

    const params = (prisma.$queryRaw as jest.Mock).mock.calls[0];
    expect(JSON.stringify(params)).toContain(SESSION_ID);
  });

  it("matches the sender's display name, which is what a reader actually sees", async () => {
    const { service, prisma } = buildService();
    await service.search(SESSION_ID, USER, [], 'Morgan Reyes');

    const args = prisma.emailMessage.findMany.mock.calls[0]?.[0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(args.where.OR).toContainEqual({
      senderDisplayName: { contains: 'Morgan Reyes', mode: 'insensitive' },
    });
  });
});
