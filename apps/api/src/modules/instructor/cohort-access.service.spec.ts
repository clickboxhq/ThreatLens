import { CohortAccessService } from './cohort-access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CohortStaffRole } from '@prisma/client';

const COHORT = { id: 'cohort-1', orgId: 'org-1' };

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    role: 'instructor',
    orgId: 'org-1',
    sessionVersion: 1,
    ...overrides,
  } as AuthenticatedUser;
}

function build(opts: {
  cohort?: { id: string; orgId: string | null } | null;
  staff?: { role: CohortStaffRole } | null;
  groupIds?: string[];
}) {
  const prisma = {
    cohort: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.cohort === undefined ? COHORT : opts.cohort),
      findMany: jest.fn().mockResolvedValue([{ id: 'cohort-org' }]),
    },
    cohortStaff: {
      findUnique: jest.fn().mockResolvedValue(opts.staff ?? null),
      findMany: jest.fn().mockResolvedValue([{ cohortId: 'cohort-1' }]),
    },
    cohortGroupTutor: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (opts.groupIds ?? []).map((groupId) => ({ groupId })),
        ),
    },
  } as unknown as PrismaService;
  return new CohortAccessService(prisma);
}

describe('CohortAccessService', () => {
  describe('staff roles', () => {
    it('lets a lead do everything, including managing staff', async () => {
      const a = await build({ staff: { role: 'lead' } }).requireAccess(
        'cohort-1',
        user(),
        'lead',
      );
      expect(a.canManageStaff).toBe(true);
      expect(a.groupScoped).toBe(false);
    });

    it('lets a tutor teach the cohort but not manage staff', async () => {
      const a = await build({ staff: { role: 'tutor' } }).requireAccess(
        'cohort-1',
        user(),
        'tutor',
      );
      expect(a.canManageStaff).toBe(false);
      expect(a.groupScoped).toBe(false);
    });

    it('refuses a tutor an action that requires lead', async () => {
      await expect(
        build({ staff: { role: 'tutor' } }).requireAccess(
          'cohort-1',
          user(),
          'lead',
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('scopes a group_tutor to their own groups', async () => {
      const a = await build({
        staff: { role: 'group_tutor' },
        groupIds: ['group-a', 'group-b'],
      }).requireAccess('cohort-1', user());

      expect(a.groupScoped).toBe(true);
      expect(a.groupIds).toEqual(['group-a', 'group-b']);
    });
  });

  describe('enrollment scoping', () => {
    it('shows a whole-cohort tutor every student', async () => {
      const svc = build({ staff: { role: 'tutor' } });
      const a = await svc.requireAccess('cohort-1', user());
      expect(svc.enrollmentScope(a)).toEqual({ cohortId: 'cohort-1' });
    });

    it('shows a group_tutor only their groups', async () => {
      const svc = build({
        staff: { role: 'group_tutor' },
        groupIds: ['group-a'],
      });
      const a = await svc.requireAccess('cohort-1', user());
      expect(svc.enrollmentScope(a)).toEqual({
        cohortId: 'cohort-1',
        groupId: { in: ['group-a'] },
      });
    });

    it('shows a group_tutor with no groups NOBODY, not everybody', async () => {
      // The failure direction matters. An unconfigured tutor silently receiving cohort-wide
      // access is exactly the bug this scoping exists to prevent.
      const svc = build({ staff: { role: 'group_tutor' }, groupIds: [] });
      const a = await svc.requireAccess('cohort-1', user());
      expect(svc.enrollmentScope(a)).toEqual({
        cohortId: 'cohort-1',
        groupId: { in: [] },
      });
    });
  });

  describe('org_admin', () => {
    it('may read a cohort in their own organisation without being staffed on it', async () => {
      const a = await build({ staff: null }).requireAccess(
        'cohort-1',
        user({ role: 'org_admin' }),
      );
      expect(a.role).toBeNull();
      expect(a.canWrite).toBe(false);
    });

    it('may not change it', async () => {
      await expect(
        build({ staff: null }).requireAccess(
          'cohort-1',
          user({ role: 'org_admin' }),
          'tutor',
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('cannot reach a cohort in a different organisation', async () => {
      await expect(
        build({ staff: null }).requireAccess(
          'cohort-1',
          user({ role: 'org_admin', orgId: 'some-other-org' }),
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('everyone else', () => {
    it('gets 404, not 403, so cohort ids cannot be probed', async () => {
      // A 403 would confirm the cohort exists. An unrelated instructor should not be able to
      // tell a real cohort id from a made-up one.
      await expect(
        build({ staff: null }).requireAccess('cohort-1', user()),
      ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });

    it('gets the same 404 for a cohort that genuinely does not exist', async () => {
      await expect(
        build({ cohort: null, staff: null }).requireAccess('nope', user()),
      ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });
  });
});
