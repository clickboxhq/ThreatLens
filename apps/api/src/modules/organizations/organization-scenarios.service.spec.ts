import { OrganizationScenariosService } from './organization-scenarios.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function buildUser(
  overrides: Partial<Record<string, unknown>> = {},
): AuthenticatedUser {
  return {
    id: 'user-1',
    role: 'student',
    orgId: null,
    ...overrides,
  } as AuthenticatedUser;
}

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const dbUser = {
    id: 'user-1',
    orgId: null as string | null,
    orgMembershipStatus: 'active' as 'active' | 'suspended',
    role: 'student',
    ...overrides,
  };

  const orgScenarioRow = {
    id: 'os-1',
    orgId: 'org-1',
    scenarioId: 'scenario-1',
    dueAt: null as Date | null,
    addedBy: 'admin-1',
    addedAt: new Date('2026-09-01'),
    removedAt: null as Date | null,
    scenario: {
      id: 'scenario-1',
      slug: 'bec-scenario',
      title: 'Business Email Compromise',
      difficulty: 'intermediate',
      category: 'email',
      estimatedMinutes: 45,
    },
    org: { name: 'Contoso University' },
    _count: { assignments: 2 },
  };

  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(async () => dbUser),
      findMany: jest.fn(async () => [{ id: 'member-1' }, { id: 'member-2' }]),
    },
    attackScenario: {
      findMany: jest.fn(
        async (args?: {
          where: { id: { in: string[] } };
        }): Promise<Array<{ id: string }>> =>
          args ? args.where.id.in.map((id) => ({ id })) : [],
      ),
    },
    organizationScenario: {
      upsert: jest.fn(async () => orgScenarioRow),
      findUnique: jest.fn(
        async (): Promise<Partial<typeof orgScenarioRow> | null> =>
          orgScenarioRow,
      ),
      findUniqueOrThrow: jest.fn(async () => orgScenarioRow),
      findMany: jest.fn(async () => [orgScenarioRow]),
      update: jest.fn(async () => undefined),
    },
    organizationScenarioAssignment: {
      createMany: jest.fn(async () => ({ count: 0 })),
      findMany: jest.fn(
        async (): Promise<
          Array<{
            id?: string;
            assignedAt?: Date;
            userId?: string;
            organizationScenario?: typeof orgScenarioRow;
          }>
        > => [
          {
            id: 'assign-1',
            assignedAt: new Date('2026-09-02'),
            organizationScenario: orgScenarioRow,
          },
        ],
      ),
    },
    investigationSession: {
      findMany: jest.fn(async () => []),
    },
  };
  const auditLog = { record: jest.fn(async () => undefined) };
  const notificationsService = { create: jest.fn(async () => undefined) };

  const service = new OrganizationScenariosService(
    prisma as never,
    auditLog as never,
    notificationsService as never,
  );
  return { service, prisma, auditLog, notificationsService, orgScenarioRow };
}

describe('OrganizationScenariosService.addScenarios', () => {
  it('rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.addScenarios(buildUser({ role: 'student' }), ['scenario-1']),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('404s when a scenario id does not resolve to a published scenario', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.attackScenario.findMany = jest.fn(async () => []); // none published
    await expect(
      service.addScenarios(buildUser({ role: 'org_admin' }), ['scenario-1']),
    ).rejects.toMatchObject({ status: 404, code: 'SCENARIO_NOT_FOUND' });
  });

  it('bulk-adds, fans assignments out to every active member (not suspended/removed ones), and audits it', async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });

    await service.addScenarios(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      ['scenario-1', 'scenario-2'],
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-1', orgMembershipStatus: 'active' },
      }),
    );
    expect(prisma.organizationScenario.upsert).toHaveBeenCalledTimes(2);
    expect(
      prisma.organizationScenarioAssignment.createMany,
    ).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_scenarios_added' }),
    );
  });

  it('re-adding an already-added scenario reactivates it via upsert rather than duplicating (unique(orgId, scenarioId) + skipDuplicates)', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.addScenarios(buildUser({ role: 'org_admin' }), [
      'scenario-1',
    ]);
    expect(prisma.organizationScenario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId_scenarioId: { orgId: 'org-1', scenarioId: 'scenario-1' },
        },
        update: expect.objectContaining({ removedAt: null }),
      }),
    );
  });
});

describe('OrganizationScenariosService.removeScenario', () => {
  it('rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.removeScenario(buildUser({ role: 'student' }), 'os-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("404s on a scenario relationship from a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationScenario.findUnique = jest.fn(async () => ({
      id: 'os-1',
      orgId: 'some-other-org',
      removedAt: null,
    }));
    await expect(
      service.removeScenario(buildUser({ role: 'org_admin' }), 'os-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('soft-removes (sets removedAt) rather than deleting — the global scenario and any assignment/session rows are never touched', async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.removeScenario(buildUser({ role: 'org_admin' }), 'os-1');
    expect(prisma.organizationScenario.update).toHaveBeenCalledWith({
      where: { id: 'os-1' },
      data: { removedAt: expect.any(Date) },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_scenario_removed' }),
    );
  });
});

describe('OrganizationScenariosService.updateDueDate', () => {
  it('rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.updateDueDate(
        buildUser({ role: 'student' }),
        'os-1',
        '2026-09-25',
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects an invalid date', async () => {
    const { service } = buildService({ orgId: 'org-1', role: 'org_admin' });
    await expect(
      service.updateDueDate(
        buildUser({ role: 'org_admin' }),
        'os-1',
        'not-a-real-date',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('sets the due date, notifies currently-assigned members (excluding the actor), and audits it', async () => {
    const { service, prisma, auditLog, notificationsService } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    // A real query with `userId: { not: 'admin-1' }` would never return admin-1's own row —
    // the mock returns just what that filter would, so this test exercises the actual
    // notify-everyone-but-the-actor loop rather than re-testing Prisma's own filtering.
    prisma.organizationScenarioAssignment.findMany = jest.fn(async () => [
      { userId: 'student-1' },
    ]);

    await service.updateDueDate(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      'os-1',
      '2026-09-25T00:00:00.000Z',
    );

    expect(prisma.organizationScenarioAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationScenarioId: 'os-1',
          userId: { not: 'admin-1' },
        },
      }),
    );
    expect(prisma.organizationScenario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'os-1' },
        data: { dueAt: expect.any(Date) },
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledTimes(1);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', category: 'assignment' }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization_scenario_due_date_updated',
      }),
    );
  });

  it('clears the due date when passed null, and sends no notification', async () => {
    const { service, prisma, notificationsService } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.updateDueDate(buildUser({ role: 'org_admin' }), 'os-1', null);
    expect(prisma.organizationScenario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dueAt: null } }),
    );
    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});

describe('OrganizationScenariosService.listMyAssignedScenarios', () => {
  it('403s an individual account with no organization', async () => {
    const { service } = buildService({ orgId: null });
    await expect(
      service.listMyAssignedScenarios(buildUser()),
    ).rejects.toMatchObject({ status: 403, code: 'NOT_ACTIVE_ORG_MEMBER' });
  });

  it('403s a suspended member — immediate loss of access, not an empty list', async () => {
    const { service } = buildService({
      orgId: 'org-1',
      orgMembershipStatus: 'suspended',
    });
    await expect(
      service.listMyAssignedScenarios(buildUser({ orgId: 'org-1' })),
    ).rejects.toMatchObject({ status: 403, code: 'NOT_ACTIVE_ORG_MEMBER' });
  });

  it("returns the caller's own assignments, scoped by userId — never another student's or another org's rows", async () => {
    const { service, prisma } = buildService({ orgId: 'org-1' });
    const user = buildUser({ id: 'student-1', orgId: 'org-1' });

    const result = await service.listMyAssignedScenarios(user);

    expect(prisma.organizationScenarioAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'student-1',
          organizationScenario: { orgId: 'org-1', removedAt: null },
        },
      }),
    );
    expect(prisma.investigationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'student-1', scenarioId: { in: ['scenario-1'] } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      scenarioId: 'scenario-1',
      title: 'Business Email Compromise',
      organizationName: 'Contoso University',
      status: 'assigned',
    });
  });

  it('computes "overdue" for a past-due assignment with no session yet, and "completed" with a score once scored', async () => {
    const { service, prisma } = buildService({ orgId: 'org-1' });
    prisma.organizationScenarioAssignment.findMany = jest.fn(async () => [
      {
        id: 'assign-1',
        assignedAt: new Date('2026-09-02'),
        organizationScenario: {
          ...(await prisma.organizationScenario.findUniqueOrThrow()),
          dueAt: new Date('2020-01-01'), // long past
        },
      },
    ]);

    const overdue = await service.listMyAssignedScenarios(
      buildUser({ id: 'student-1', orgId: 'org-1' }),
    );
    expect(overdue[0].status).toBe('overdue');

    prisma.investigationSession.findMany = jest.fn(async () => [
      {
        scenarioId: 'scenario-1',
        status: 'scored',
        startedAt: new Date(),
        score: { overallPercent: 88 },
      },
    ]);
    const completed = await service.listMyAssignedScenarios(
      buildUser({ id: 'student-1', orgId: 'org-1' }),
    );
    expect(completed[0]).toMatchObject({
      status: 'completed',
      scorePercent: 88,
    });
  });
});

describe('OrganizationScenariosService.assignAllActiveScenariosToNewMember', () => {
  it("fans out every currently-active org scenario to the new member's id", async () => {
    const { service, prisma } = buildService();
    await service.assignAllActiveScenariosToNewMember('org-1', 'new-member-1');
    expect(prisma.organizationScenario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', removedAt: null } }),
    );
    expect(
      prisma.organizationScenarioAssignment.createMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ organizationScenarioId: 'os-1', userId: 'new-member-1' }],
        skipDuplicates: true,
      }),
    );
  });

  it('is a no-op when the org has no active scenarios', async () => {
    const { service, prisma } = buildService();
    prisma.organizationScenario.findMany = jest.fn(async () => []);
    await service.assignAllActiveScenariosToNewMember('org-1', 'new-member-1');
    expect(
      prisma.organizationScenarioAssignment.createMany,
    ).not.toHaveBeenCalled();
  });
});
