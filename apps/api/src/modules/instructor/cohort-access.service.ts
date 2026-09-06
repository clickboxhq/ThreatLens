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
 *
 * platform_admin reaches every cohort, but only to read it or to repair its staffing. The
 * case this exists for is mundane and needs no bug: a tutor leaves, and their account was the
 * only lead on several cohorts, so nobody can restaff them. Teaching — assignments, grading,
 * feedback — stays with the people actually running the cohort, so a support action can never
 * be mistaken for an instructor's own.
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
  /**
   * True when the caller is staff on the cohort, which is what authorises teaching actions —
   * assignments, grading, feedback. False for an org_admin or platform_admin, who can reach
   * the cohort without teaching it. Enforce this for any write that is not staffing.
   */
  canWrite: boolean;
  canManageStaff: boolean;
  /** True once the cohort is retired. Reads still work; anything that adds new work does not. */
  archived: boolean;
  /** True when access came from being a platform admin, so an override can be audited as one. */
  isPlatformAdmin: boolean;
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
      select: { id: true, orgId: true, archivedAt: true },
    });
    if (!cohort) throw new AppException(404, 'NOT_FOUND', 'Cohort not found.');
    const archived = cohort.archivedAt !== null;

    const staff = await this.prisma.cohortStaff.findUnique({
      where: { cohortId_userId: { cohortId, userId: user.id } },
    });

    if (!staff) {
      // The permitted set here is deliberately not a rank range: 'lead' (staffing) is allowed
      // while 'tutor' (teaching) is refused, even though lead outranks tutor. The distinction
      // is what the action is, not how much authority it takes.
      if (user.role === 'platform_admin') {
        if (minRole === 'tutor') {
          throw new AppException(
            403,
            'FORBIDDEN',
            'Platform admins can repair a cohort’s staffing but not teach it.',
          );
        }
        return {
          cohortId,
          role: null,
          groupScoped: false,
          groupIds: [],
          canWrite: false,
          canManageStaff: true,
          isPlatformAdmin: true,
          archived,
        };
      }

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
        isPlatformAdmin: false,
        archived,
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
      // Every staff role can teach; this is what separates staff from an org_admin or
      // platform_admin who can see the cohort without being on it.
      canWrite: RANK[staff.role] >= RANK['group_tutor'],
      canManageStaff: staff.role === 'lead',
      isPlatformAdmin: false,
      archived,
    };
  }

  /**
   * Refuses anything that would add new work to a retired cohort.
   *
   * Reading stays open — the point of archiving rather than deleting is that last term's
   * grades, feedback and certificates remain answerable. What stops is anything that grows
   * it: new assignments, new members, new staff, new sessions.
   */
  assertNotArchived(access: CohortAccess) {
    if (access.archived) {
      throw new AppException(
        409,
        'COHORT_ARCHIVED',
        'This cohort is archived. Restore it before making changes.',
      );
    }
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

    // A platform admin can reach every cohort, so listing is not scoped for them.
    if (user.role === 'platform_admin') {
      const all = await this.prisma.cohort.findMany({ select: { id: true } });
      for (const c of all) ids.add(c.id);
      return [...ids];
    }

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
