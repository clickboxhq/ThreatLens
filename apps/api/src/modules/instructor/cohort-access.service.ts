import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CohortStaffRole } from '@prisma/client';

/**
 * Who may do what to a cohort.
 *
 * Cohorts used to be owned by exactly one instructor, checked with
 * `cohort.ownerId !== user.id`. That made a cohort a private list: a colleague teaching the
 * same class could not see it, and neither could an org_admin whose organisation was paying
 * for it. Authorization now reads cohort_staff, and owner_id is only a record of who created
 * the cohort.
 *
 * Three staff roles, in descending authority:
 *   lead         full control, including staffing and deleting the cohort
 *   tutor        teaches the whole cohort — assignments, review queue, feedback
 *   group_tutor  the same, but only over the groups they are assigned to
 *
 * org_admin gets read access to every cohort in their organisation without being staffed on
 * it, and no write access. Seeing what is running under your organisation is a different
 * thing from teaching it.
 */

const RANK: Record<CohortStaffRole, number> = {
  lead: 3,
  tutor: 2,
  group_tutor: 1,
};

export interface CohortAccess {
  cohortId: string;
  /** Null when access comes from being an org_admin rather than from being staff. */
  role: CohortStaffRole | null;
  /** True when the caller may only see their own groups. */
  groupScoped: boolean;
  /** Populated for a group_tutor; empty otherwise. */
  groupIds: string[];
  canWrite: boolean;
  canManageStaff: boolean;
}

@Injectable()
export class CohortAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves what this caller may do with this cohort, or throws.
   *
   * `minRole` is the least authority that satisfies the caller's intent. Read-only callers
   * pass 'group_tutor'; anything that mutates the cohort passes 'tutor' or 'lead'.
   */
  async requireAccess(
    cohortId: string,
    user: AuthenticatedUser,
    minRole: CohortStaffRole = 'group_tutor',
  ): Promise<CohortAccess> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, orgId: true },
    });
    if (!cohort) throw new AppException(404, 'NOT_FOUND', 'Cohort not found.');

    const staff = await this.prisma.cohortStaff.findUnique({
      where: { cohortId_userId: { cohortId, userId: user.id } },
    });

    if (!staff) {
      // An org_admin may look at any cohort in their organisation, but not change it. Anyone
      // else gets the same 404 a non-existent cohort gives, so the endpoint cannot be used to
      // discover which cohort ids are real.
      const isOrgAdmin =
        user.role === 'org_admin' &&
        user.orgId !== null &&
        cohort.orgId === user.orgId;

      if (!isOrgAdmin) {
        throw new AppException(404, 'NOT_FOUND', 'Cohort not found.');
      }
      if (minRole !== 'group_tutor') {
        throw new AppException(
          403,
          'FORBIDDEN',
          'Organisation admins can view this cohort but not change it.',
        );
      }
      return {
        cohortId,
        role: null,
        groupScoped: false,
        groupIds: [],
        canWrite: false,
        canManageStaff: false,
      };
    }

    if (RANK[staff.role] < RANK[minRole]) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Your role on this cohort does not allow that.',
      );
    }

    const groupScoped = staff.role === 'group_tutor';
    const groupIds = groupScoped
      ? (
          await this.prisma.cohortGroupTutor.findMany({
            where: { userId: user.id, group: { cohortId } },
            select: { groupId: true },
          })
        ).map((g) => g.groupId)
      : [];

    return {
      cohortId,
      role: staff.role,
      groupScoped,
      groupIds,
      canWrite: RANK[staff.role] >= RANK['group_tutor'],
      canManageStaff: staff.role === 'lead',
    };
  }

  /**
   * A Prisma filter restricting enrollments to what this caller may see.
   *
   * A group_tutor with no groups assigned yet sees nobody rather than everybody — the failure
   * direction matters, and an unconfigured tutor should not silently get cohort-wide access.
   */
  enrollmentScope(access: CohortAccess) {
    if (!access.groupScoped) return { cohortId: access.cohortId };
    return {
      cohortId: access.cohortId,
      groupId: { in: access.groupIds },
    };
  }

  /** Every cohort this user can reach, whether as staff or as an org_admin. */
  async listAccessibleCohortIds(user: AuthenticatedUser): Promise<string[]> {
    const staffed = await this.prisma.cohortStaff.findMany({
      where: { userId: user.id },
      select: { cohortId: true },
    });
    const ids = new Set(staffed.map((s) => s.cohortId));

    if (user.role === 'org_admin' && user.orgId) {
      const orgCohorts = await this.prisma.cohort.findMany({
        where: { orgId: user.orgId },
        select: { id: true },
      });
      for (const c of orgCohorts) ids.add(c.id);
    }

    return [...ids];
  }
}
