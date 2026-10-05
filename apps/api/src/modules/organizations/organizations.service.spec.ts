import { randomUUID } from 'crypto';
import { OrganizationsService } from './organizations.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function buildUser(
  overrides: Partial<Record<string, unknown>> = {},
): AuthenticatedUser {
  return {
    id: randomUUID(),
    role: 'student',
    orgId: null,
    ...overrides,
  } as AuthenticatedUser;
}

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const orgId = randomUUID();
  const dbUser = {
    id: 'user-1',
    email: 'admin@contoso.com',
    displayName: 'Ada Admin',
    orgId: null as string | null,
    orgMembershipStatus: 'active' as 'active' | 'suspended',
    role: 'student',
    ...overrides,
  };

  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(async () => dbUser),
      findUnique: jest.fn(async () => null),
      // Explicit generic (rather than an unused `args` parameter) widens the mock's declared
      // signature so a later per-test override can accept `{ where }` — jest.fn()'s inferred
      // type otherwise locks reassignment to this exact zero-arg shape.
      findMany: jest.fn<
        Promise<Array<{ id: string; email: string; displayName: string }>>,
        [args?: { where?: { id?: { in?: string[] } } }]
      >(async () => [
        { id: 'm1', email: 'm1@contoso.com', displayName: 'Member One' },
        { id: 'm2', email: 'm2@contoso.com', displayName: 'Member Two' },
        {
          id: 'user-1',
          email: 'admin@contoso.com',
          displayName: 'Ada Admin',
        },
      ]),
      update: jest.fn(async (args: { data: unknown }) => ({
        ...dbUser,
        ...(args.data as object),
      })),
    },
    organization: {
      create: jest.fn(async (args: { data: { id: string; name: string } }) => ({
        id: args.data.id,
        name: args.data.name,
      })),
      findUniqueOrThrow: jest.fn(async () => ({
        id: orgId,
        name: 'Contoso University',
        _count: { users: 3 },
        createdAt: new Date(),
      })),
      update: jest.fn(async () => undefined),
    },
    organizationInvite: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'invite-1',
        ...args.data,
      })),
      update: jest.fn(
        async (args?: {
          data: Record<string, unknown>;
        }): Promise<Record<string, unknown> | undefined> =>
          args ? undefined : undefined,
      ),
    },
    cohort: {
      findUnique: jest.fn(async () => ({ id: 'cohort-1', orgId: 'org-1' })),
      findMany: jest.fn(async () => []),
    },
    cohortEnrollment: {
      findMany: jest.fn(
        async (): Promise<
          Array<{
            userId?: string;
            cohortId?: string;
            cohort?: { orgId: string | null };
          }>
        > => [
          { userId: 'm1', cohort: { orgId: null } },
          { userId: 'm2', cohort: { orgId: null } },
        ],
      ),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    announcement: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 'ann-1',
        ...args.data,
      })),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'ann-1',
        title: 'Heads up',
        body: 'Body',
        cohortId: null,
        recipientCount: 2,
        createdAt: new Date(),
        author: { displayName: 'Ada Admin' },
        cohort: null,
      })),
      update: jest.fn(async () => undefined),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const emailService = { send: jest.fn(async () => undefined) };
  const auditLog = { record: jest.fn(async () => undefined) };
  const config = { get: jest.fn(() => 'https://threatlensapp.com') };
  const notificationsService = {
    create: jest.fn(async () => undefined),
    createMany: jest.fn(async () => undefined),
  };
  const organizationScenariosService = {
    assignAllActiveScenariosToNewMember: jest.fn(async () => undefined),
  };

  const service = new OrganizationsService(
    prisma as never,
    emailService as never,
    auditLog as never,
    config as never,
    notificationsService as never,
    organizationScenariosService as never,
  );
  return {
    service,
    prisma,
    emailService,
    auditLog,
    notificationsService,
    organizationScenariosService,
    orgId,
  };
}

describe('OrganizationsService.create', () => {
  it('creates an org and promotes the caller to org_admin', async () => {
    const { service, prisma } = buildService();
    const user = buildUser({ role: 'instructor' });

    const result = await service.create(user, { name: 'Contoso University' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'org_admin' }),
      }),
    );
    expect(result.name).toBe('Contoso University');
  });

  it('rejects if the caller already belongs to an organization', async () => {
    const { service } = buildService({ orgId: 'existing-org' });
    const user = buildUser({ role: 'instructor' });

    await expect(
      service.create(user, { name: 'Contoso University' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_IN_ORGANIZATION',
    });
  });

  it('rejects a plain student from self-promoting to org_admin', async () => {
    const { service } = buildService();
    const user = buildUser({ role: 'student' });

    await expect(
      service.create(user, { name: 'Contoso University' }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });
});

describe('OrganizationsService member/invite access control', () => {
  it('listMembers() rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    const user = buildUser({ role: 'instructor' });

    await expect(service.listMembers(user)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('listMembers() rejects an org_admin with no organization', async () => {
    const { service } = buildService({ orgId: null });
    const user = buildUser({ role: 'org_admin' });

    await expect(service.listMembers(user)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_IN_ORGANIZATION',
    });
  });

  it('createInvite() sends a real email and records an audit entry', async () => {
    const { service, emailService, auditLog, orgId } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    const user = buildUser({ role: 'org_admin' });
    void orgId;

    await service.createInvite(user, {
      email: 'newhire@contoso.com',
      role: 'student',
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newhire@contoso.com',
        subject: expect.stringContaining('Contoso University'),
      }),
    );
    const sent = (emailService.send as jest.Mock).mock.calls[0][0] as {
      html: string;
    };
    expect(sent.html).toContain('Accept Invitation');
    expect(sent.html).toContain('Contoso University');
    expect(sent.html).toContain('Student');
    expect(sent.html).toContain('This invitation expires in 7 days.');
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_invite_sent' }),
    );
  });

  it('createInvite() rejects inviting someone already in the same org', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique.mockResolvedValueOnce({ orgId: 'org-1' });
    const user = buildUser({ role: 'org_admin' });

    await expect(
      service.createInvite(user, {
        email: 'already@contoso.com',
        role: 'student',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_A_MEMBER' });
  });
});

describe('OrganizationsService invite management', () => {
  const pendingInvite = {
    id: 'invite-1',
    organizationId: 'org-1',
    email: 'candidate@contoso.com',
    role: 'student',
    status: 'pending',
    token: 'old-token',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  };

  it('revokeInvite rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    await expect(
      service.revokeInvite(buildUser({ role: 'student' }), 'invite-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("revokeInvite 404s on an invite belonging to a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationInvite.findUnique = jest.fn(async () => ({
      ...pendingInvite,
      organizationId: 'some-other-org',
    }));
    await expect(
      service.revokeInvite(buildUser({ role: 'org_admin' }), 'invite-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('revokeInvite marks the invite revoked and audits it', async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationInvite.findUnique = jest.fn(async () => pendingInvite);

    await service.revokeInvite(buildUser({ role: 'org_admin' }), 'invite-1');

    expect(prisma.organizationInvite.update).toHaveBeenCalledWith({
      where: { id: 'invite-1' },
      data: { status: 'revoked' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_invite_revoked' }),
    );
  });

  it('revokeInvite rejects an invite that is no longer pending', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationInvite.findUnique = jest.fn(async () => ({
      ...pendingInvite,
      status: 'accepted',
    }));
    await expect(
      service.revokeInvite(buildUser({ role: 'org_admin' }), 'invite-1'),
    ).rejects.toMatchObject({ status: 409, code: 'INVITE_NOT_PENDING' });
  });

  it('resendInvite rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    await expect(
      service.resendInvite(buildUser({ role: 'student' }), 'invite-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("resendInvite 404s on an invite belonging to a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationInvite.findUnique = jest.fn(async () => ({
      ...pendingInvite,
      organizationId: 'some-other-org',
    }));
    await expect(
      service.resendInvite(buildUser({ role: 'org_admin' }), 'invite-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('resendInvite reissues the token/expiry, re-sends the email, and audits it', async () => {
    const { service, prisma, emailService, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.organizationInvite.findUnique = jest.fn(async () => pendingInvite);
    prisma.organizationInvite.update = jest.fn(
      async (args: { data: Record<string, unknown> }) => ({
        ...pendingInvite,
        ...args.data,
      }),
    );

    await service.resendInvite(buildUser({ role: 'org_admin' }), 'invite-1');

    expect(prisma.organizationInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'invite-1' },
        data: expect.objectContaining({
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(
      (prisma.organizationInvite.update as jest.Mock).mock.calls[0][0].data
        .token,
    ).not.toBe('old-token');
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'candidate@contoso.com' }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_invite_resent' }),
    );
  });
});

describe('OrganizationsService.rename', () => {
  it('rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    const user = buildUser({ role: 'instructor' });

    await expect(
      service.rename(user, { name: 'New Name' }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects an org_admin with no organization', async () => {
    const { service } = buildService({ orgId: null });
    const user = buildUser({ role: 'org_admin' });

    await expect(
      service.rename(user, { name: 'New Name' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_IN_ORGANIZATION' });
  });

  it("updates the org's name and returns the refreshed org DTO", async () => {
    const { service, prisma, orgId } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    const user = buildUser({ role: 'org_admin' });

    const result = await service.rename(user, { name: 'New Name' });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { name: 'New Name' },
    });
    expect(result).toEqual({
      id: orgId,
      name: 'Contoso University',
      memberCount: 3,
      createdAt: expect.any(Date),
    });
  });
});

describe('OrganizationsService logo', () => {
  const DATA_URL = 'data:image/png;base64,AAAA';

  it('setLogo rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.setLogo(buildUser({ role: 'instructor' }), DATA_URL),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('setLogo rejects an org_admin with no organization', async () => {
    const { service } = buildService({ orgId: null });
    await expect(
      service.setLogo(buildUser({ role: 'org_admin' }), DATA_URL),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_IN_ORGANIZATION' });
  });

  it("setLogo writes the data URL to the caller's own org and audits it", async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.setLogo(buildUser({ role: 'org_admin' }), DATA_URL);

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { logoDataUrl: DATA_URL },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization_logo_updated',
        targetId: 'org-1',
      }),
    );
  });

  it("removeLogo nulls the column on the caller's own org", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.removeLogo(buildUser({ role: 'org_admin' }));

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { logoDataUrl: null },
    });
  });

  it('removeLogo rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    await expect(
      service.removeLogo(buildUser({ role: 'student' })),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('OrganizationsService announcements', () => {
  const dto = { title: 'Heads up', body: 'Read this' };

  it('createAnnouncement rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.createAnnouncement(buildUser({ role: 'instructor' }), dto),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('org-wide: fans out one notification per member, minus the author, and audits it', async () => {
    const { service, prisma, notificationsService, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.createAnnouncement(
      buildUser({ id: 'user-1', role: 'org_admin' }),
      dto,
    );

    // member mock returns m1, m2, user-1 — the author (user-1) must be dropped.
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['m1', 'm2'],
        category: 'announcement',
        link: '/app/announcements',
      }),
    );
    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientCount: 2, cohortId: null }),
      }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_announcement_sent' }),
    );
  });

  it('emails every recipient alongside the in-app notification, but never the author', async () => {
    const { service, prisma, emailService } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    // The base mock's user.findMany ignores `where` and always returns all 3 seeded users —
    // fine for resolveAnnouncementRecipients' unfiltered "all org members" call, but the
    // email fan-out's own `where: { id: { in: notifyIds } } }` call needs the real filtering
    // behaviour simulated, or it would (wrongly) get the author back too.
    const allUsers = [
      { id: 'm1', email: 'm1@contoso.com', displayName: 'Member One' },
      { id: 'm2', email: 'm2@contoso.com', displayName: 'Member Two' },
      { id: 'user-1', email: 'admin@contoso.com', displayName: 'Ada Admin' },
    ];
    prisma.user.findMany = jest.fn(
      async (args?: { where?: { id?: { in?: string[] } } }) =>
        args?.where?.id?.in
          ? allUsers.filter((u) => args.where!.id!.in!.includes(u.id))
          : allUsers,
    );
    await service.createAnnouncement(
      buildUser({ id: 'user-1', role: 'org_admin' }),
      dto,
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['m1', 'm2'] } } }),
    );
    expect(emailService.send).toHaveBeenCalledTimes(2);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'm1@contoso.com',
        subject: expect.stringContaining(dto.title),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'm2@contoso.com' }),
    );
    expect(emailService.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@contoso.com' }),
    );
  });

  it("skips the email fan-out entirely when there's nobody to notify", async () => {
    const { service, prisma, emailService } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findMany = jest.fn(async () => [
      { id: 'user-1', email: 'admin@contoso.com', displayName: 'Ada Admin' },
    ]);
    await service.createAnnouncement(
      buildUser({ id: 'user-1', role: 'org_admin' }),
      dto,
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('rejects a cohort target that belongs to a different organisation', async () => {
    const { service, prisma, notificationsService } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.cohort.findUnique.mockResolvedValueOnce({
      id: 'cohort-x',
      orgId: 'some-other-org',
    });

    await expect(
      service.createAnnouncement(buildUser({ role: 'org_admin' }), {
        ...dto,
        cohortId: 'cohort-x',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it('listMyAnnouncements returns [] for a user with no organisation and no active cohort enrollment', async () => {
    const { service, prisma } = buildService({ orgId: null });
    prisma.cohortEnrollment.findMany = jest.fn(async () => []);
    await expect(
      service.listMyAnnouncements(buildUser({ role: 'student' })),
    ).resolves.toEqual([]);
    // Short-circuits before ever querying announcements — nothing to scope to.
    expect(prisma.announcement.findMany).not.toHaveBeenCalled();
  });

  // Regression for the ClickBox bug: a notification for a cohort-targeted announcement
  // arrived, but opening Announcements showed "No announcements". Root cause —
  // cohort-invite.service.ts's accept() enrolls a user in a cohort without ever setting
  // their `orgId` (a cohort roster and an org's member list are separate lists), so a
  // cohort-only member has `orgId === null` even though resolveAnnouncementRecipients
  // (used by createAnnouncement, above) already counts them as a legitimate recipient of
  // that cohort's announcements. listMyAnnouncements has to recognise the same membership.
  it('listMyAnnouncements returns cohort-scoped announcements for a cohort-only member with no formal org membership', async () => {
    const { service, prisma } = buildService({ orgId: null });
    prisma.cohortEnrollment.findMany = jest.fn(async () => [
      { cohortId: 'cohort-1', cohort: { orgId: 'org-1' } },
    ]);
    prisma.announcement.findMany = jest.fn(async () => [
      {
        id: 'ann-cohort-1',
        title: 'Cohort-only announcement',
        body: 'Body',
        cohortId: 'cohort-1',
        recipientCount: 1,
        createdAt: new Date(),
        author: { displayName: 'Ada Admin' },
        cohort: { name: 'Repro Cohort' },
      },
    ]);

    const result = await service.listMyAnnouncements(
      buildUser({ role: 'student' }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ann-cohort-1');
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, OR: [{ cohortId: { in: ['cohort-1'] } }] },
      }),
    );
  });

  it("listMyAnnouncements includes both the caller's org-wide announcements and their cohort's, when both apply", async () => {
    const { service, prisma } = buildService({ orgId: 'org-1' });
    prisma.cohortEnrollment.findMany = jest.fn(async () => [
      { cohortId: 'cohort-1', cohort: { orgId: 'some-other-org' } },
    ]);
    await service.listMyAnnouncements(
      buildUser({ id: 'user-1', role: 'student', orgId: 'org-1' }),
    );
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            { orgId: 'org-1', cohortId: null },
            { cohortId: { in: ['cohort-1'] } },
          ],
        },
      }),
    );
  });

  it('listSentAnnouncements rejects a non-org_admin caller', async () => {
    const { service } = buildService();
    await expect(
      service.listSentAnnouncements(buildUser({ role: 'student' })),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('OrganizationsService.deleteAnnouncement', () => {
  it('rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.deleteAnnouncement(buildUser({ role: 'student' }), 'ann-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("404s on an announcement that belongs to a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.announcement.findUnique = jest.fn(async () => ({
      id: 'ann-x',
      orgId: 'some-other-org',
      deletedAt: null,
    }));

    await expect(
      service.deleteAnnouncement(buildUser({ role: 'org_admin' }), 'ann-x'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the caller's own org announcement and audits it", async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.announcement.findUnique = jest.fn(async () => ({
      id: 'ann-1',
      orgId: 'org-1',
      deletedAt: null,
    }));

    await service.deleteAnnouncement(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      'ann-1',
    );

    expect(prisma.announcement.update).toHaveBeenCalledWith({
      where: { id: 'ann-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'organization_announcement_deleted',
      }),
    );
  });

  it('is a no-op on an already-deleted announcement', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.announcement.findUnique = jest.fn(async () => ({
      id: 'ann-1',
      orgId: 'org-1',
      deletedAt: new Date(),
    }));

    await service.deleteAnnouncement(buildUser({ role: 'org_admin' }), 'ann-1');
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });
});

describe('OrganizationsService.removeMember', () => {
  it('rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.removeMember(buildUser({ role: 'student' }), 'member-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects an org_admin trying to remove themselves', async () => {
    const { service } = buildService({ orgId: 'org-1', role: 'org_admin' });
    const admin = buildUser({ id: 'admin-1', role: 'org_admin' });
    await expect(service.removeMember(admin, admin.id)).rejects.toMatchObject({
      status: 400,
      code: 'CANNOT_MANAGE_SELF',
    });
  });

  it("404s on a member from a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => ({
      id: 'member-1',
      orgId: 'some-other-org',
      email: 'x@other.test',
      displayName: 'X',
    }));

    await expect(
      service.removeMember(buildUser({ role: 'org_admin' }), 'member-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it("clears the member's orgId, drops their active enrollments in this org's cohorts, bumps sessionVersion, and audits it", async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => ({
      id: 'member-1',
      orgId: 'org-1',
      email: 'student@contoso.com',
      displayName: 'Sam Student',
    }));
    prisma.cohort.findMany = jest.fn(async () => [
      { id: 'cohort-1' },
      { id: 'cohort-2' },
    ]);

    await service.removeMember(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      'member-1',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: {
        orgId: null,
        orgMembershipStatus: 'active',
        orgJoinedAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(prisma.cohortEnrollment.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'member-1',
        cohortId: { in: ['cohort-1', 'cohort-2'] },
        status: 'active',
      },
      data: { status: 'dropped' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_member_removed' }),
    );
  });
});

describe('OrganizationsService.suspendMember / restoreMember', () => {
  const activeMember = {
    id: 'member-1',
    orgId: 'org-1',
    email: 'student@contoso.com',
    displayName: 'Sam Student',
    orgMembershipStatus: 'active' as const,
  };
  const suspendedMember = {
    ...activeMember,
    orgMembershipStatus: 'suspended' as const,
  };

  it('suspendMember rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.suspendMember(buildUser({ role: 'student' }), 'member-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('suspendMember rejects an org_admin trying to suspend themselves', async () => {
    const { service } = buildService({ orgId: 'org-1', role: 'org_admin' });
    const admin = buildUser({ id: 'admin-1', role: 'org_admin' });
    await expect(service.suspendMember(admin, admin.id)).rejects.toMatchObject({
      status: 400,
      code: 'CANNOT_MANAGE_SELF',
    });
  });

  it("suspendMember 404s on a member from a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => ({
      ...activeMember,
      orgId: 'some-other-org',
    }));
    await expect(
      service.suspendMember(buildUser({ role: 'org_admin' }), 'member-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('suspendMember flips status, bumps sessionVersion (immediate revocation), and audits it', async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => activeMember);

    await service.suspendMember(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      'member-1',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: {
        orgMembershipStatus: 'suspended',
        sessionVersion: { increment: 1 },
      },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_member_suspended' }),
    );
  });

  it('suspendMember is a no-op on an already-suspended member', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => suspendedMember);

    await service.suspendMember(buildUser({ role: 'org_admin' }), 'member-1');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('restoreMember rejects a caller who is not an org_admin', async () => {
    const { service } = buildService();
    await expect(
      service.restoreMember(buildUser({ role: 'student' }), 'member-1'),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("restoreMember 404s on a member from a different organisation (an admin can't reach across tenants)", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => ({
      ...suspendedMember,
      orgId: 'some-other-org',
    }));
    await expect(
      service.restoreMember(buildUser({ role: 'org_admin' }), 'member-1'),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('restoreMember flips status back to active and audits it — no session bump (only grants)', async () => {
    const { service, prisma, auditLog } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    prisma.user.findUnique = jest.fn(async () => suspendedMember);

    await service.restoreMember(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      'member-1',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: { orgMembershipStatus: 'active' },
    });
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'organization_member_restored' }),
    );
  });
});

describe('OrganizationsService — suspension blocks announcement access', () => {
  it("listMyAnnouncements excludes a suspended member's own org-wide announcements", async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      orgMembershipStatus: 'suspended',
    });
    prisma.cohortEnrollment.findMany = jest.fn(async () => []);

    const result = await service.listMyAnnouncements(
      buildUser({ orgId: 'org-1' }),
    );
    expect(result).toEqual([]);
    expect(prisma.announcement.findMany).not.toHaveBeenCalled();
  });

  it('resolveAnnouncementRecipients (via createAnnouncement) excludes suspended members from an org-wide send', async () => {
    const { service, prisma } = buildService({
      orgId: 'org-1',
      role: 'org_admin',
    });
    await service.createAnnouncement(
      buildUser({ id: 'admin-1', role: 'org_admin' }),
      {
        title: 'Heads up',
        body: 'Read this',
      },
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: 'org-1',
          orgMembershipStatus: 'active',
          deletedAt: null,
        },
      }),
    );
  });
});

describe('OrganizationsService invite preview and acceptance', () => {
  it('previewInvite() 404s on an unknown token', async () => {
    const { service } = buildService();
    await expect(service.previewInvite('bogus')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('previewInvite() reports "expired" for a past-due pending invite without a DB write', async () => {
    const { service, prisma } = buildService();
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000),
      email: 'someone@contoso.com',
      role: 'student',
      organization: { name: 'Contoso University' },
    });

    const result = await service.previewInvite('expired-token');

    expect(result.status).toBe('expired');
  });

  it("acceptInvite() rejects when the invite's email doesn't match the caller's account", async () => {
    const { service, prisma } = buildService({ email: 'me@contoso.com' });
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 100_000),
      email: 'someone-else@contoso.com',
      role: 'student',
      organizationId: 'org-1',
    });
    const user = buildUser();

    await expect(service.acceptInvite(user, 'tok')).rejects.toMatchObject({
      status: 403,
      code: 'EMAIL_MISMATCH',
    });
  });

  it('acceptInvite() rejects when the caller already belongs to an organization', async () => {
    const { service, prisma } = buildService({
      email: 'me@contoso.com',
      orgId: 'org-existing',
    });
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 100_000),
      email: 'me@contoso.com',
      role: 'student',
      organizationId: 'org-1',
    });
    const user = buildUser();

    await expect(service.acceptInvite(user, 'tok')).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_IN_ORGANIZATION',
    });
  });

  it('acceptInvite() sets orgId and the invited role, and marks the invite accepted', async () => {
    const { service, prisma, notificationsService } = buildService({
      email: 'me@contoso.com',
      orgId: null,
    });
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 100_000),
      email: 'me@contoso.com',
      role: 'instructor',
      organizationId: 'org-1',
      invitedBy: 'admin-1',
    });
    prisma.user.findMany = jest.fn(async () => [
      { id: 'admin-1', displayName: 'Ada Admin', email: 'admin@contoso.com' },
    ]);
    const user = buildUser();

    await service.acceptInvite(user, 'tok');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org-1', role: 'instructor' }),
      }),
    );
    expect(prisma.organizationInvite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'accepted' }),
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        category: 'org_invitation',
        title: 'New student joined your organization',
      }),
    );
  });

  it('acceptInvite() emails every org_admin of the org — not just the original inviter — and the notification/email never fire before membership is actually created', async () => {
    const { service, prisma, notificationsService, emailService } =
      buildService({
        email: 'me@contoso.com',
        orgId: null,
      });
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'pending',
      expiresAt: new Date(Date.now() + 100_000),
      email: 'me@contoso.com',
      role: 'student',
      organizationId: 'org-1',
      invitedBy: 'admin-1',
    });
    prisma.user.findMany = jest.fn(async () => [
      { id: 'admin-1', displayName: 'Ada Admin', email: 'ada@contoso.com' },
      { id: 'admin-2', displayName: 'Bo Admin', email: 'bo@contoso.com' },
    ]);
    const user = buildUser();

    // The transaction (membership creation) must be attempted before either channel fires.
    let transactionRanBeforeNotify = false;
    (prisma.$transaction as jest.Mock).mockImplementationOnce(
      async (ops: Promise<unknown>[]) => {
        const result = await Promise.all(ops);
        transactionRanBeforeNotify = true;
        return result;
      },
    );

    await service.acceptInvite(user, 'tok');

    expect(transactionRanBeforeNotify).toBe(true);
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1' }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-2' }),
    );

    expect(emailService.send).toHaveBeenCalledTimes(2);
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@contoso.com',
        subject: expect.stringContaining('New student joined'),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'bo@contoso.com' }),
    );
    const sent = (emailService.send as jest.Mock).mock.calls[0][0] as {
      html: string;
    };
    expect(sent.html).toContain('Contoso University');
    expect(sent.html).toContain('View Organization Members');
  });

  it('acceptInvite() rejects an already-accepted invite', async () => {
    const { service, prisma } = buildService({ email: 'me@contoso.com' });
    prisma.organizationInvite.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      status: 'accepted',
      expiresAt: new Date(Date.now() + 100_000),
      email: 'me@contoso.com',
      role: 'student',
      organizationId: 'org-1',
    });
    const user = buildUser();

    await expect(service.acceptInvite(user, 'tok')).rejects.toMatchObject({
      status: 409,
      code: 'INVITE_NOT_PENDING',
    });
  });
});
