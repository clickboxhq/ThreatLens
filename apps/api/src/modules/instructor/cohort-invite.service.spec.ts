import { CohortInviteService } from './cohort-invite.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const TUTOR = { id: 'tutor-1' } as AuthenticatedUser;
const HOUR = 60 * 60 * 1000;

function build(
  opts: {
    invite?: Record<string, unknown> | null;
    accountExists?: boolean;
    enrolled?: boolean;
    groupScoped?: boolean;
    groupIds?: string[];
    meEmail?: string;
    meRole?: string;
    alreadyStaff?: boolean;
  } = {},
) {
  const send = jest.fn().mockResolvedValue(undefined);
  const inviteUpsert = jest.fn(
    async (args: { create: unknown; update: unknown }) => ({
      id: 'invite-1',
      email: 'invitee@example.com',
      groupId: null,
      token: 'tok',
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
      acceptedAt: null,
      group: null,
      ...(args.create as object),
    }),
  );
  const enrollmentCreate = jest.fn().mockResolvedValue({});
  const staffCreate = jest.fn().mockResolvedValue({});
  const inviteUpdate = jest.fn().mockResolvedValue({});

  const prisma = {
    cohortInvite: {
      findUnique: jest.fn().mockResolvedValue(opts.invite ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.invite ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: inviteUpsert,
      update: inviteUpdate,
    },
    cohortGroup: { findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }) },
    cohortStaff: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.alreadyStaff ? { userId: 'me-1' } : null),
      create: staffCreate,
    },
    cohortEnrollment: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.enrolled ? { userId: 'u' } : null),
      create: enrollmentCreate,
    },
    cohort: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'c1', name: 'Autumn 2026' }),
      findUnique: jest.fn().mockResolvedValue({ archivedAt: null }),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.accountExists ? { id: 'invitee-1' } : null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'me-1',
        displayName: 'Dana',
        email: opts.meEmail ?? 'invitee@example.com',
        role: opts.meRole ?? 'instructor',
      }),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const access = {
    requireAccess: jest.fn().mockResolvedValue({
      cohortId: 'c1',
      role: opts.groupScoped ? 'group_tutor' : 'tutor',
      groupScoped: opts.groupScoped ?? false,
      groupIds: opts.groupIds ?? [],
      canWrite: true,
      canManageStaff: false,
      isPlatformAdmin: false,
      archived: false,
    }),
    assertNotArchived: jest.fn(),
  };
  const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn(() => 'https://threatlensapp.com') };
  const notifications = { create: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new CohortInviteService(
      prisma,
      access as never,
      auditLog as never,
      { send } as never,
      config as never,
      notifications as never,
    ),
    send,
    inviteUpsert,
    inviteUpdate,
    enrollmentCreate,
    staffCreate,
    notifications,
  };
}

describe('CohortInviteService', () => {
  describe('sending', () => {
    it('emails the invitee a join link', async () => {
      const { service, send } = build();
      await service.create(TUTOR, 'c1', 'Invitee@Example.com');

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'invitee@example.com' }),
      );
      expect(send.mock.calls[0][0].html).toContain('/join-cohort/');
    });

    it('normalises the address, so a re-invite hits the same row', async () => {
      const { service, inviteUpsert } = build();
      await service.create(TUTOR, 'c1', '  Mixed.Case@Example.COM ');
      expect(inviteUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cohortId_email: { cohortId: 'c1', email: 'mixed.case@example.com' },
          },
        }),
      );
    });

    it('refuses somebody already enrolled', async () => {
      // Otherwise they get a link whose only possible outcome is "you are already in".
      const { service } = build({ accountExists: true, enrolled: true });
      await expect(
        service.create(TUTOR, 'c1', 'invitee@example.com'),
      ).rejects.toMatchObject({ code: 'ALREADY_ENROLLED' });
    });

    it('tells an invitee with no account that they will need one', async () => {
      const { service, send } = build({ accountExists: false });
      await service.create(TUTOR, 'c1', 'newcomer@example.com');
      expect(send.mock.calls[0][0].html).toContain('create an account');
    });

    it('tells an existing user to sign in instead', async () => {
      const { service, send } = build({ accountExists: true });
      await service.create(TUTOR, 'c1', 'invitee@example.com');
      expect(send.mock.calls[0][0].html).toContain('Sign in');
    });
  });

  describe('group tutors', () => {
    it('cannot invite into the cohort at large', async () => {
      const { service } = build({ groupScoped: true, groupIds: ['group-1'] });
      await expect(
        service.create(TUTOR, 'c1', 'x@example.com'),
      ).rejects.toMatchObject({ code: 'GROUP_REQUIRED' });
    });

    it('cannot invite into a group they do not run', async () => {
      const { service } = build({
        groupScoped: true,
        groupIds: ['group-mine'],
      });
      await expect(
        service.create(TUTOR, 'c1', 'x@example.com', 'group-theirs'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  describe('accepting', () => {
    const pending = {
      id: 'invite-1',
      cohortId: 'c1',
      groupId: 'group-1',
      email: 'invitee@example.com',
      status: 'pending',
      invitedBy: 'tutor-1',
      expiresAt: new Date(Date.now() + HOUR),
      cohort: { id: 'c1', name: 'Autumn 2026' },
    };

    it('enrols the invitee into the invited group', async () => {
      const { service, enrollmentCreate } = build({ invite: pending });
      await service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok');
      expect(enrollmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groupId: 'group-1',
            status: 'active',
          }),
        }),
      );
    });

    it('notifies whoever sent it', async () => {
      const { service, notifications } = build({ invite: pending });
      await service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok');
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'tutor-1' }),
      );
    });

    it('refuses an account whose address does not match the invite', async () => {
      // The invite is addressed to a person. Forwarding it must not let somebody else in.
      const { service } = build({
        invite: pending,
        meEmail: 'somebody-else@example.com',
      });
      await expect(
        service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok'),
      ).rejects.toMatchObject({ code: 'EMAIL_MISMATCH' });
    });

    it('refuses an expired invite even though the row still says pending', async () => {
      // Expiry is a timestamp, not a status the database rewrites, so the stored value keeps
      // saying "pending" forever. Every read has to apply the clock.
      const { service } = build({
        invite: { ...pending, expiresAt: new Date(Date.now() - HOUR) },
      });
      await expect(
        service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok'),
      ).rejects.toMatchObject({ code: 'INVITE_NOT_PENDING' });
    });

    it('is idempotent when they are already enrolled', async () => {
      const { service, enrollmentCreate } = build({
        invite: pending,
        enrolled: true,
      });
      await expect(
        service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok'),
      ).resolves.toMatchObject({ cohortId: 'c1' });
      expect(enrollmentCreate).not.toHaveBeenCalled();
    });
  });

  // Staffing used to require the person to already have an account. Inviting them is the only
  // way to bring in a tutor who has never used ThreatLens.
  describe('staff invitations', () => {
    const staffInvite = {
      id: 'invite-1',
      cohortId: 'c1',
      groupId: null,
      staffRole: 'tutor',
      email: 'invitee@example.com',
      status: 'pending',
      invitedBy: 'lead-1',
      expiresAt: new Date(Date.now() + HOUR),
      cohort: { id: 'c1', name: 'Autumn 2026' },
    };

    it('needs lead, not tutor, to send one', async () => {
      const { service } = build();
      await service.create(TUTOR, 'c1', 'x@example.com', null, 'tutor');
      // requireAccess is the gate; assert it was asked for the stronger role.
      const access = (
        service as unknown as { cohortAccess: { requireAccess: jest.Mock } }
      ).cohortAccess;
      expect(access.requireAccess).toHaveBeenCalledWith('c1', TUTOR, 'lead');
    });

    it('staffs them on the cohort rather than enrolling them', async () => {
      const { service, staffCreate, enrollmentCreate } = build({
        invite: staffInvite,
      });
      await service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok');
      expect(staffCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'tutor', userId: 'me-1' }),
        }),
      );
      expect(enrollmentCreate).not.toHaveBeenCalled();
    });

    it('refuses a student account, the same rule addStaff applies', async () => {
      // The invite goes to an address; whoever signs up with it picks their own account type.
      // An invitation grants a role on this cohort, never a different kind of account.
      const { service } = build({ invite: staffInvite, meRole: 'student' });
      await expect(
        service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok'),
      ).rejects.toMatchObject({ code: 'NOT_AN_INSTRUCTOR' });
    });

    it('is idempotent when they are already staffed', async () => {
      const { service, staffCreate } = build({
        invite: staffInvite,
        alreadyStaff: true,
      });
      await service.accept({ id: 'me-1' } as AuthenticatedUser, 'tok');
      expect(staffCreate).not.toHaveBeenCalled();
    });
  });

  describe('preview', () => {
    it('reports expired without writing to the row', async () => {
      const { service, inviteUpdate } = build({
        invite: {
          ...{
            id: 'i',
            cohortId: 'c1',
            groupId: null,
            email: 'invitee@example.com',
            status: 'pending',
            invitedBy: 't',
          },
          expiresAt: new Date(Date.now() - HOUR),
          cohort: { name: 'Autumn 2026' },
          group: null,
          inviter: { displayName: 'Dana' },
        },
      });
      const result = await service.preview('tok');
      expect(result.status).toBe('expired');
      expect(inviteUpdate).not.toHaveBeenCalled();
    });
  });

  describe('revoking', () => {
    it('rotates the token so the mailed link stops working', async () => {
      // Marking the row revoked but leaving the token resolvable is a door that only looks
      // shut — the link in somebody's inbox would still find it.
      const { service, inviteUpdate } = build({
        invite: {
          id: 'invite-1',
          cohortId: 'c1',
          email: 'x@example.com',
          status: 'pending',
        },
      });
      await service.revoke(TUTOR, 'c1', 'invite-1');
      const data = inviteUpdate.mock.calls[0][0].data as {
        status: string;
        token: string;
      };
      expect(data.status).toBe('revoked');
      expect(data.token).toMatch(/^revoked:/);
    });

    it('refuses to revoke one that was already accepted', async () => {
      const { service } = build({
        invite: {
          id: 'invite-1',
          cohortId: 'c1',
          email: 'x@example.com',
          status: 'accepted',
        },
      });
      await expect(
        service.revoke(TUTOR, 'c1', 'invite-1'),
      ).rejects.toMatchObject({ code: 'ALREADY_ACCEPTED' });
    });
  });
});
