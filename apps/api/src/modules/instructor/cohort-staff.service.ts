import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { CohortAccessService } from './cohort-access.service';
import { CohortInviteService } from './cohort-invite.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CohortStaffRole } from '@prisma/client';

/**
 * Managing who teaches a cohort, and how its students are grouped.
 *
 * The rule that matters most here is that a cohort must never lose its last lead. Only a lead
 * can staff a cohort, so a cohort with none is unadministrable — nobody can add a tutor, place
 * a student, or hand it over. That is the same shape as the MFA lockout this codebase already
 * has a break-glass script for, and it is much cheaper to prevent than to repair.
 */
@Injectable()
export class CohortStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortAccess: CohortAccessService,
    private readonly auditLog: AuditLogService,
    private readonly invites: CohortInviteService,
  ) {}

  /**
   * Marks an action taken by a platform admin who is not staffed on the cohort. Without it the
   * audit log cannot distinguish support repairing a cohort from its own lead acting normally.
   */
  private override(access: { isPlatformAdmin: boolean }) {
    return access.isPlatformAdmin ? { platformAdminOverride: true } : {};
  }

  // ---------------------------------------------------------------- staff

  async listStaff(user: AuthenticatedUser, cohortId: string) {
    await this.cohortAccess.requireAccess(cohortId, user);
    const staff = await this.prisma.cohortStaff.findMany({
      where: { cohortId },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { addedAt: 'asc' },
    });

    const groupTutorships = await this.prisma.cohortGroupTutor.findMany({
      where: { group: { cohortId } },
      include: { group: { select: { id: true, name: true } } },
    });

    return staff.map((s) => ({
      userId: s.userId,
      displayName: s.user.displayName,
      email: s.user.email,
      role: s.role,
      addedAt: s.addedAt,
      // Only meaningful for a group_tutor, but returned uniformly so the client does not have
      // to special-case the shape.
      groups: groupTutorships
        .filter((t) => t.userId === s.userId)
        .map((t) => ({ id: t.group.id, name: t.group.name })),
    }));
  }

  async addStaff(
    user: AuthenticatedUser,
    cohortId: string,
    email: string,
    role: CohortStaffRole,
  ) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'lead',
    );

    const invitee = await this.prisma.user.findUnique({ where: { email } });
    if (!invitee) {
      // No account yet, so there is nobody to staff — send them an invitation instead of
      // refusing. Students became invitable sight-unseen when cohort invitations landed,
      // which left tutors as the only people who had to pre-register before anyone could
      // add them. Same door, now open to both.
      await this.invites.create(user, cohortId, email, null, role);
      return this.listStaff(user, cohortId);
    }
    if (invitee.status !== 'active') {
      throw new AppException(
        400,
        'USER_NOT_ACTIVE',
        'That account is not active.',
      );
    }
    // A platform admin may staff a cohort but not teach it. Staffing themselves would turn
    // that into one API call: they would become staff, canWrite would be true, and they could
    // grade. Repair means putting somebody else in charge, not taking charge.
    //
    // This is a guardrail, not a wall — a platform admin has database access by other means.
    // The point is that the restriction cannot be stepped around by accident, and that doing
    // it deliberately has to happen somewhere that leaves a different kind of trace.
    if (access.isPlatformAdmin && invitee.id === user.id) {
      throw new AppException(
        403,
        'CANNOT_STAFF_SELF',
        'Platform admins can staff a cohort with somebody else, but not with themselves.',
      );
    }

    // Students are enrolled, not staffed. Staffing one would give them access to the review
    // queue and to other students' work.
    if (invitee.role === 'student') {
      throw new AppException(
        400,
        'NOT_AN_INSTRUCTOR',
        'That account is a student. Only instructors can be added as cohort staff.',
      );
    }

    const existing = await this.prisma.cohortStaff.findUnique({
      where: { cohortId_userId: { cohortId, userId: invitee.id } },
    });
    if (existing) {
      throw new AppException(
        409,
        'ALREADY_STAFF',
        'That person is already staffed on this cohort.',
      );
    }

    await this.prisma.cohortStaff.create({
      data: { cohortId, userId: invitee.id, role, addedBy: user.id },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_staff_added',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: {
        staffUserId: invitee.id,
        email,
        role,
        ...this.override(access),
      },
    });

    return this.listStaff(user, cohortId);
  }

  async updateStaffRole(
    user: AuthenticatedUser,
    cohortId: string,
    userId: string,
    role: CohortStaffRole,
  ) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'lead',
    );
    const target = await this.getStaffOrThrow(cohortId, userId);

    if (target.role === 'lead' && role !== 'lead') {
      await this.assertNotLastLead(cohortId, userId);
    }

    await this.prisma.cohortStaff.update({
      where: { cohortId_userId: { cohortId, userId } },
      data: { role },
    });

    // Demoting away from group_tutor leaves group assignments that no longer mean anything.
    if (target.role === 'group_tutor' && role !== 'group_tutor') {
      await this.prisma.cohortGroupTutor.deleteMany({
        where: { userId, group: { cohortId } },
      });
    }

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_staff_role_changed',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: {
        staffUserId: userId,
        from: target.role,
        to: role,
        ...this.override(access),
      },
    });

    return this.listStaff(user, cohortId);
  }

  async removeStaff(user: AuthenticatedUser, cohortId: string, userId: string) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'lead',
    );
    const target = await this.getStaffOrThrow(cohortId, userId);

    if (target.role === 'lead') {
      await this.assertNotLastLead(cohortId, userId);
    }

    await this.prisma.$transaction([
      this.prisma.cohortGroupTutor.deleteMany({
        where: { userId, group: { cohortId } },
      }),
      this.prisma.cohortStaff.delete({
        where: { cohortId_userId: { cohortId, userId } },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_staff_removed',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: {
        staffUserId: userId,
        role: target.role,
        ...this.override(access),
      },
    });

    return this.listStaff(user, cohortId);
  }

  // ---------------------------------------------------------------- groups

  async listGroups(user: AuthenticatedUser, cohortId: string) {
    const access = await this.cohortAccess.requireAccess(cohortId, user);
    const groups = await this.prisma.cohortGroup.findMany({
      // A group_tutor sees only the groups they run.
      where: access.groupScoped
        ? { cohortId, id: { in: access.groupIds } }
        : { cohortId },
      include: {
        tutors: {
          include: { user: { select: { id: true, displayName: true } } },
        },
        _count: { select: { enrollments: true, assignments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      studentCount: g._count.enrollments,
      assignmentCount: g._count.assignments,
      tutors: g.tutors.map((t) => ({
        userId: t.userId,
        displayName: t.user.displayName,
      })),
      createdAt: g.createdAt,
    }));
  }

  async createGroup(user: AuthenticatedUser, cohortId: string, name: string) {
    await this.cohortAccess.requireAccess(cohortId, user, 'tutor');

    const existing = await this.prisma.cohortGroup.findUnique({
      where: { cohortId_name: { cohortId, name } },
    });
    if (existing) {
      throw new AppException(
        409,
        'GROUP_EXISTS',
        'A group with that name already exists in this cohort.',
      );
    }

    await this.prisma.cohortGroup.create({ data: { cohortId, name } });
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_group_created',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { name },
    });
    return this.listGroups(user, cohortId);
  }

  async deleteGroup(
    user: AuthenticatedUser,
    cohortId: string,
    groupId: string,
  ) {
    await this.cohortAccess.requireAccess(cohortId, user, 'tutor');
    await this.getGroupOrThrow(cohortId, groupId);

    // Students are not unenrolled — their group_id is nulled by the schema's SetNull, so they
    // stay in the cohort and simply become ungrouped. Group-scoped assignments cascade away
    // with the group, since they were only ever meaningful in its context.
    await this.prisma.cohortGroup.delete({ where: { id: groupId } });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_group_deleted',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { groupId },
    });
    return this.listGroups(user, cohortId);
  }

  async assignGroupTutor(
    user: AuthenticatedUser,
    cohortId: string,
    groupId: string,
    userId: string,
  ) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'lead',
    );
    await this.getGroupOrThrow(cohortId, groupId);

    // They must already be staff — a group tutorship is a narrowing of cohort access, not a
    // way to grant it.
    const staff = await this.getStaffOrThrow(cohortId, userId);
    if (staff.role !== 'group_tutor') {
      throw new AppException(
        400,
        'NOT_GROUP_SCOPED',
        'Only a group tutor is assigned to specific groups. A lead or tutor already covers the whole cohort.',
      );
    }

    await this.prisma.cohortGroupTutor.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_group_tutor_assigned',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { groupId, staffUserId: userId, ...this.override(access) },
    });
    return this.listGroups(user, cohortId);
  }

  async removeGroupTutor(
    user: AuthenticatedUser,
    cohortId: string,
    groupId: string,
    userId: string,
  ) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'lead',
    );
    await this.getGroupOrThrow(cohortId, groupId);
    await this.prisma.cohortGroupTutor.deleteMany({
      where: { groupId, userId },
    });
    // Every other staffing change is recorded; this one was not, so removing somebody's
    // access left no trace while granting it did.
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_group_tutor_removed',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { groupId, staffUserId: userId, ...this.override(access) },
    });
    return this.listGroups(user, cohortId);
  }

  async placeStudentInGroup(
    user: AuthenticatedUser,
    cohortId: string,
    studentUserId: string,
    groupId: string | null,
  ) {
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'tutor',
    );

    const enrollment = await this.prisma.cohortEnrollment.findUnique({
      where: { cohortId_userId: { cohortId, userId: studentUserId } },
    });
    if (!enrollment) {
      throw new AppException(
        404,
        'NOT_ENROLLED',
        'That student is not enrolled in this cohort.',
      );
    }

    if (groupId) {
      await this.getGroupOrThrow(cohortId, groupId);
      // A group_tutor can move students within their own groups but not into somebody else's.
      if (access.groupScoped && !access.groupIds.includes(groupId)) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'You can only place students into groups you run.',
        );
      }
    }

    await this.prisma.cohortEnrollment.update({
      where: { cohortId_userId: { cohortId, userId: studentUserId } },
      data: { groupId },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_student_grouped',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { studentUserId, groupId },
    });
    return { userId: studentUserId, groupId };
  }

  // ---------------------------------------------------------------- helpers

  private async getStaffOrThrow(cohortId: string, userId: string) {
    const staff = await this.prisma.cohortStaff.findUnique({
      where: { cohortId_userId: { cohortId, userId } },
    });
    if (!staff) {
      throw new AppException(
        404,
        'NOT_STAFF',
        'That person is not staffed on this cohort.',
      );
    }
    return staff;
  }

  private async getGroupOrThrow(cohortId: string, groupId: string) {
    const group = await this.prisma.cohortGroup.findFirst({
      where: { id: groupId, cohortId },
    });
    if (!group) throw new AppException(404, 'NOT_FOUND', 'Group not found.');
    return group;
  }

  /**
   * Only a lead can staff a cohort, so removing or demoting the last one leaves it with nobody
   * able to add a tutor, place a student, or hand it over. Refuse rather than create a cohort
   * that needs database surgery to recover.
   */
  private async assertNotLastLead(cohortId: string, userId: string) {
    const otherLeads = await this.prisma.cohortStaff.count({
      where: { cohortId, role: 'lead', userId: { not: userId } },
    });
    if (otherLeads === 0) {
      throw new AppException(
        409,
        'LAST_LEAD',
        'This is the only lead on the cohort. Promote somebody else to lead first.',
      );
    }
  }
}
