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
    orgId: null as string | null,
    role: 'student',
    ...overrides,
  };

  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn(async () => dbUser),
      findUnique: jest.fn(async () => null),
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
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const emailService = { send: jest.fn(async () => undefined) };
  const auditLog = { record: jest.fn(async () => undefined) };
  const config = { get: jest.fn(() => 'https://threatlensapp.com') };
  const notificationsService = { create: jest.fn(async () => undefined) };

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
      expect.objectContaining({ to: 'newhire@contoso.com' }),
    );
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
