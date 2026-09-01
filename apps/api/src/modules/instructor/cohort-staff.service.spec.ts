import { CohortStaffService } from './cohort-staff.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CohortStaffRole } from '@prisma/client';

const LEAD = { id: 'lead-1' } as AuthenticatedUser;

function build(
  opts: {
    targetRole?: CohortStaffRole;
    otherLeadCount?: number;
    invitee?: { id: string; status: string; role: string } | null;
    groupScoped?: boolean;
    groupIds?: string[];
    isPlatformAdmin?: boolean;
  } = {},
) {
  const staffUpdate = jest.fn().mockResolvedValue({});
  const staffDelete = jest.fn().mockResolvedValue({});
  const staffCreate = jest.fn().mockResolvedValue({});
  const groupTutorDeleteMany = jest.fn().mockResolvedValue({});

  const prisma = {
    cohortStaff: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.targetRole
            ? { role: opts.targetRole, userId: 'target-1' }
            : null,
        ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(opts.otherLeadCount ?? 1),
      create: staffCreate,
      update: staffUpdate,
      delete: staffDelete,
    },
    cohortGroupTutor: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: groupTutorDeleteMany,
      upsert: jest.fn().mockResolvedValue({}),
    },
    cohortGroup: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ id: 'group-1' }),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    cohortEnrollment: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'student-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.invitee === undefined
            ? { id: 'invitee-1', status: 'active', role: 'instructor' }
            : opts.invitee,
        ),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const access = {
    requireAccess: jest.fn().mockResolvedValue({
      cohortId: 'cohort-1',
      role: 'lead',
      groupScoped: opts.groupScoped ?? false,
      groupIds: opts.groupIds ?? [],
      canWrite: true,
      canManageStaff: true,
      isPlatformAdmin: opts.isPlatformAdmin ?? false,
    }),
    enrollmentScope: (a: { cohortId: string }) => ({ cohortId: a.cohortId }),
  };
  const auditLog = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    service: new CohortStaffService(prisma, access as never, auditLog as never),
    staffCreate,
    staffDelete,
    groupTutorDeleteMany,
    auditLog,
  };
}

describe('CohortStaffService', () => {
  // A cohort with no lead cannot be staffed, grouped, or handed over — only a lead can do any
  // of those. Preventing it is far cheaper than repairing it, which is the same lesson the
  // MFA break-glass script exists to teach.
  describe('last-lead protection', () => {
    it('refuses to remove the only lead', async () => {
      const { service } = build({ targetRole: 'lead', otherLeadCount: 0 });
      await expect(
        service.removeStaff(LEAD, 'cohort-1', 'target-1'),
      ).rejects.toMatchObject({ code: 'LAST_LEAD' });
    });

    it('refuses to demote the only lead', async () => {
      const { service } = build({ targetRole: 'lead', otherLeadCount: 0 });
      await expect(
        service.updateStaffRole(LEAD, 'cohort-1', 'target-1', 'tutor'),
      ).rejects.toMatchObject({ code: 'LAST_LEAD' });
    });

    it('allows removing a lead when another one remains', async () => {
      const { service, staffDelete } = build({
        targetRole: 'lead',
        otherLeadCount: 1,
      });
      await service.removeStaff(LEAD, 'cohort-1', 'target-1');
      expect(staffDelete).toHaveBeenCalled();
    });

    it('does not block removing a non-lead', async () => {
      const { service, staffDelete } = build({
        targetRole: 'tutor',
        otherLeadCount: 0,
      });
      await service.removeStaff(LEAD, 'cohort-1', 'target-1');
      expect(staffDelete).toHaveBeenCalled();
    });
  });

  describe('adding staff', () => {
    it('refuses a student', async () => {
      // Staffing a student would hand them the review queue and other students' work.
      const { service } = build({
        invitee: { id: 'u', status: 'active', role: 'student' },
      });
      await expect(
        service.addStaff(LEAD, 'cohort-1', 'someone@example.com', 'tutor'),
      ).rejects.toMatchObject({ code: 'NOT_AN_INSTRUCTOR' });
    });

    it('refuses an email with no account', async () => {
      const { service } = build({ invitee: null });
      await expect(
        service.addStaff(LEAD, 'cohort-1', 'nobody@example.com', 'tutor'),
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    });

    it('refuses a deactivated account', async () => {
      const { service } = build({
        invitee: { id: 'u', status: 'disabled', role: 'instructor' },
      });
      await expect(
        service.addStaff(LEAD, 'cohort-1', 'x@example.com', 'tutor'),
      ).rejects.toMatchObject({ code: 'USER_NOT_ACTIVE' });
    });

    it('adds an instructor and records it in the audit log', async () => {
      const { service, staffCreate, auditLog } = build({
        targetRole: undefined,
      });
      await service.addStaff(
        LEAD,
        'cohort-1',
        'colleague@example.com',
        'tutor',
      );
      expect(staffCreate).toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'cohort_staff_added' }),
      );
    });
  });

  // Support repairing a cohort and the cohort's own lead acting normally produce the same
  // rows otherwise, and the log is the only place the difference survives.
  describe('platform admin overrides', () => {
    it('marks staffing done by a platform admin as an override', async () => {
      const { service, auditLog } = build({ isPlatformAdmin: true });
      await service.addStaff(LEAD, 'cohort-1', 'colleague@example.com', 'lead');

      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ platformAdminOverride: true }),
        }),
      );
    });

    it("does not mark a real lead's own action as an override", async () => {
      const { service, auditLog } = build();
      await service.addStaff(
        LEAD,
        'cohort-1',
        'colleague@example.com',
        'tutor',
      );

      const call = auditLog.record.mock.calls[0][0] as {
        metadata: Record<string, unknown>;
      };
      expect(call.metadata).not.toHaveProperty('platformAdminOverride');
    });
  });

  describe('role changes', () => {
    it('clears group tutorships when demoting away from group_tutor', async () => {
      // Otherwise the rows linger, pointing at groups the person no longer has a scoped role
      // over — harmless today, confusing the moment they are re-promoted.
      const { service, groupTutorDeleteMany } = build({
        targetRole: 'group_tutor',
        otherLeadCount: 1,
      });
      await service.updateStaffRole(LEAD, 'cohort-1', 'target-1', 'tutor');
      expect(groupTutorDeleteMany).toHaveBeenCalled();
    });
  });

  describe('group placement', () => {
    it('stops a group tutor moving a student into a group they do not run', async () => {
      const { service } = build({
        groupScoped: true,
        groupIds: ['group-mine'],
      });
      await expect(
        service.placeStudentInGroup(
          LEAD,
          'cohort-1',
          'student-1',
          'group-theirs',
        ),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('lets a whole-cohort tutor place anyone anywhere', async () => {
      const { service } = build({ groupScoped: false });
      await expect(
        service.placeStudentInGroup(LEAD, 'cohort-1', 'student-1', 'group-1'),
      ).resolves.toMatchObject({ groupId: 'group-1' });
    });
  });
});
