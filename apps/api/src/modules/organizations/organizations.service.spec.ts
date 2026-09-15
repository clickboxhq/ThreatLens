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
    role: 'student',
    ...overrides,
  };

  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(async () => dbUser),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => [
        { id: 'm1' },
        { id: 'm2' },
        { id: 'user-1' },
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
      update: jest.fn(async () => undefined),
    },
    cohort: {
      findUnique: jest.fn(async () => ({ id: 'cohort-1', orgId: 'org-1' })),
      findMany: jest.fn(async () => []),
    },
    cohortEnrollment: {
      findMany: jest.fn(
        async (): Promise<Array<{ userId?: string; cohortId?: string }>> => [
          { userId: 'm1' },
          { userId: 'm2' },
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

  const service = new OrganizationsService(
    prisma as never,
    emailService as never,
    auditLog as never,
    config as never,
    notificationsService as never,
  );
  return {
    service,
    prisma,
    emailService,
    auditLog,
    notificationsService,
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
      { cohortId: 'cohort-1' },
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
      { cohortId: 'cohort-1' },
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
      code: 'CANNOT_REMOVE_SELF',
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
      data: { orgId: null, sessionVersion: { increment: 1 } },
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
      }),
    );
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
