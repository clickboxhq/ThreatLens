import { CohortAccessService } from './cohort-access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function user(): AuthenticatedUser {
  return { id: 'u1', role: 'instructor', orgId: 'org-1' } as AuthenticatedUser;
}

function build(archivedAt: Date | null) {
  const prisma = {
    cohort: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'c1', orgId: 'org-1', archivedAt }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cohortStaff: {
      findUnique: jest.fn().mockResolvedValue({ role: 'lead' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cohortGroupTutor: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new CohortAccessService(prisma);
}

describe('archived cohorts', () => {
  // Archiving is what deleting would have been if deleting were safe. It is not: enrolments
  // and assignments reference the cohort, and graded sessions reference those assignments, so
  // a delete would take a student's scored work with it.
  it('is reported on the access record', async () => {
    const access = await build(new Date()).requireAccess('c1', user());
    expect(access.archived).toBe(true);
  });

  it('is false for a live cohort', async () => {
    const access = await build(null).requireAccess('c1', user());
    expect(access.archived).toBe(false);
  });

  describe('assertNotArchived', () => {
    it('refuses work that would grow an archived cohort', async () => {
      const svc = build(new Date());
      const access = await svc.requireAccess('c1', user());
      expect(() => svc.assertNotArchived(access)).toThrow(
        expect.objectContaining({ status: 409, code: 'COHORT_ARCHIVED' }),
      );
    });

    it('allows it on a live one', async () => {
      const svc = build(null);
      const access = await svc.requireAccess('c1', user());
      expect(() => svc.assertNotArchived(access)).not.toThrow();
    });
  });

  // Reading has to keep working, or archiving becomes deleting by another name — last term's
  // grades, feedback and certificates all have to stay answerable.
  it('still grants read access, so past work stays reachable', async () => {
    const access = await build(new Date()).requireAccess('c1', user());
    expect(access.role).toBe('lead');
    expect(access.canWrite).toBe(true);
  });
});
