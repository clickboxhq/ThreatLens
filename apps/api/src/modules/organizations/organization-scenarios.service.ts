import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * §Task 2-5: organization-wide scenario management — a global AttackScenario an org_admin has
 * added to their organization's collection (OrganizationScenario), fanned out to every
 * currently-active member as an OrganizationScenarioAssignment row.
 *
 * Deliberately its own service/file rather than more methods on the already-large
 * OrganizationsService: a distinct concern (scenario management vs. membership/announcements)
 * with its own access-control shape (student-facing reads gated on *active membership*, not
 * `getOwnedOrgId`'s org_admin-only gate).
 */
@Injectable()
export class OrganizationScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---- org_admin: manage the org's scenario collection ----------------------

  /**
   * Same two-layer tenant boundary every org_admin mutation in this module uses: only the
   * org_admin of an organisation reaches here, and every row this method touches is checked
   * against *their* orgId, never a client-supplied one.
   */
  private async getOwnedOrgId(user: AuthenticatedUser): Promise<string> {
    if (user.role !== 'org_admin') {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Only an organization admin can do this.',
      );
    }
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (!me.orgId) {
      throw new AppException(
        404,
        'NOT_IN_ORGANIZATION',
        'You do not belong to an organization.',
      );
    }
    return me.orgId;
  }

  /**
   * §Task 3: bulk-add — one round trip for however many scenarios the admin multi-selected.
   * `upsert` makes this naturally idempotent both against a genuine duplicate click (the
   * unique(orgId, scenarioId) index) and against re-adding a previously-removed scenario
   * (clears `removedAt` instead of erroring), so the same click that adds five new scenarios
   * can also safely include ones already on the list.
   */
  async addScenarios(user: AuthenticatedUser, scenarioIds: string[]) {
    const orgId = await this.getOwnedOrgId(user);

    const scenarios = await this.prisma.attackScenario.findMany({
      where: { id: { in: scenarioIds }, status: 'published' },
      select: { id: true },
    });
    const validIds = new Set(scenarios.map((s) => s.id));
    const missing = scenarioIds.filter((id) => !validIds.has(id));
    if (missing.length > 0) {
      throw new AppException(
        404,
        'SCENARIO_NOT_FOUND',
        'One or more scenarios were not found or are not published.',
      );
    }

    const activeMembers = await this.prisma.user.findMany({
      where: { orgId, orgMembershipStatus: 'active' },
      select: { id: true },
    });

    const orgScenarios = [];
    for (const scenarioId of scenarioIds) {
      const orgScenario = await this.prisma.organizationScenario.upsert({
        where: { orgId_scenarioId: { orgId, scenarioId } },
        create: { orgId, scenarioId, addedBy: user.id },
        update: { removedAt: null, addedBy: user.id, addedAt: new Date() },
      });
      if (activeMembers.length > 0) {
        await this.prisma.organizationScenarioAssignment.createMany({
          data: activeMembers.map((m) => ({
            organizationScenarioId: orgScenario.id,
            userId: m.id,
          })),
          skipDuplicates: true,
        });
      }
      orgScenarios.push(orgScenario);
    }

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_scenarios_added',
      targetType: 'organization',
      targetId: orgId,
      metadata: { scenarioIds, count: scenarioIds.length },
    });

    return this.listOrgScenarios(user);
  }

  /** §Task 2 fan-out half: give a newly-joined member every scenario the org is currently
   * running, the same as if they'd been a member when each was added. Called from
   * organizations.service.ts's acceptInvite, after membership is created. */
  async assignAllActiveScenariosToNewMember(
    orgId: string,
    userId: string,
  ): Promise<void> {
    const activeOrgScenarios = await this.prisma.organizationScenario.findMany({
      where: { orgId, removedAt: null },
      select: { id: true },
    });
    if (activeOrgScenarios.length === 0) return;
    await this.prisma.organizationScenarioAssignment.createMany({
      data: activeOrgScenarios.map((os) => ({
        organizationScenarioId: os.id,
        userId,
      })),
      skipDuplicates: true,
    });
  }

  /** §Task 4: soft-remove — the relationship to the org, never the global AttackScenario, and
   * never the OrganizationScenarioAssignment/InvestigationSession rows students already have
   * against it (those aren't touched at all, so historical work stays exactly as it was). */
  async removeScenario(user: AuthenticatedUser, orgScenarioId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const orgScenario = await this.prisma.organizationScenario.findUnique({
      where: { id: orgScenarioId },
    });
    if (!orgScenario || orgScenario.orgId !== orgId) {
      throw new AppException(
        404,
        'NOT_FOUND',
        'That scenario is not part of your organization.',
      );
    }
    if (orgScenario.removedAt) return;

    await this.prisma.organizationScenario.update({
      where: { id: orgScenarioId },
      data: { removedAt: new Date() },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_scenario_removed',
      targetType: 'organization',
      targetId: orgId,
      metadata: {
        organizationScenarioId: orgScenarioId,
        scenarioId: orgScenario.scenarioId,
      },
    });
  }

  /**
   * §Task 5: the due date lives on the org-scenario row (see schema comment), so this is the
   * one place that ever changes it — every assigned member reads it from here. Optionally
   * notifies currently-assigned members, reusing the existing notification infrastructure
   * rather than a new due-date-specific system.
   */
  async updateDueDate(
    user: AuthenticatedUser,
    orgScenarioId: string,
    dueAt: string | null,
  ) {
    const orgId = await this.getOwnedOrgId(user);
    const orgScenario = await this.prisma.organizationScenario.findUnique({
      where: { id: orgScenarioId },
      include: { scenario: { select: { title: true } } },
    });
    if (!orgScenario || orgScenario.orgId !== orgId) {
      throw new AppException(
        404,
        'NOT_FOUND',
        'That scenario is not part of your organization.',
      );
    }

    const parsed = dueAt ? new Date(dueAt) : null;
    if (parsed && Number.isNaN(parsed.getTime())) {
      throw new AppException(400, 'VALIDATION_ERROR', 'Invalid due date.');
    }

    await this.prisma.organizationScenario.update({
      where: { id: orgScenarioId },
      data: { dueAt: parsed },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_scenario_due_date_updated',
      targetType: 'organization',
      targetId: orgId,
      metadata: { organizationScenarioId: orgScenarioId, dueAt: parsed },
    });

    if (parsed) {
      const assignees =
        await this.prisma.organizationScenarioAssignment.findMany({
          where: {
            organizationScenarioId: orgScenarioId,
            userId: { not: user.id },
          },
          select: { userId: true },
        });
      await Promise.all(
        assignees.map((a) =>
          this.notificationsService.create({
            userId: a.userId,
            category: 'assignment',
            title: 'Assignment due date updated',
            body: `The due date for "${orgScenario.scenario.title}" has been changed to ${parsed.toLocaleDateString('en-US', { dateStyle: 'long' } as never)}.`,
            link: '/app/assigned-scenarios',
          }),
        ),
      );
    }

    return this.toAdminScenarioDto(orgScenarioId);
  }

  /** The org admin's own scenario-management table. */
  async listOrgScenarios(user: AuthenticatedUser) {
    const orgId = await this.getOwnedOrgId(user);
    const rows = await this.prisma.organizationScenario.findMany({
      where: { orgId, removedAt: null },
      include: {
        scenario: {
          select: {
            title: true,
            difficulty: true,
            category: true,
            estimatedMinutes: true,
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { addedAt: 'desc' },
    });
    return rows.map(toAdminScenarioRowDto);
  }

  private async toAdminScenarioDto(id: string) {
    const row = await this.prisma.organizationScenario.findUniqueOrThrow({
      where: { id },
      include: {
        scenario: {
          select: {
            title: true,
            difficulty: true,
            category: true,
            estimatedMinutes: true,
          },
        },
        _count: { select: { assignments: true } },
      },
    });
    return toAdminScenarioRowDto(row);
  }

  // ---- student-facing: "Assigned Scenarios" ----------------------------------

  /**
   * §Task 2 critical access rule: an individual account (no org, or a removed/suspended
   * membership) gets a hard 403 here — never an empty list, which would let the frontend
   * silently render nothing instead of the endpoint actually refusing the request. This is
   * the same "immediately lose access" boundary suspension/removal already enforce for
   * announcements (organizations.service.ts's listMyAnnouncements), applied to assignments.
   */
  private async requireActiveOrgMembership(
    user: AuthenticatedUser,
  ): Promise<string> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { orgId: true, orgMembershipStatus: true },
    });
    if (!me.orgId || me.orgMembershipStatus !== 'active') {
      throw new AppException(
        403,
        'NOT_ACTIVE_ORG_MEMBER',
        'This requires active organization membership.',
      );
    }
    return me.orgId;
  }

  /**
   * Every assignment belonging to the caller, in *their own* organization, with status
   * computed live from their own InvestigationSession history — never a second, duplicated
   * copy of progress/score. `userId: user.id` is baked into every query below, so there is no
   * parameter here a client could manipulate to reach another student's or another org's rows.
   */
  async listMyAssignedScenarios(user: AuthenticatedUser) {
    const orgId = await this.requireActiveOrgMembership(user);

    const assignments =
      await this.prisma.organizationScenarioAssignment.findMany({
        where: {
          userId: user.id,
          organizationScenario: { orgId, removedAt: null },
        },
        include: {
          organizationScenario: {
            include: {
              scenario: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  category: true,
                  difficulty: true,
                  estimatedMinutes: true,
                },
              },
              org: { select: { name: true } },
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      });
    if (assignments.length === 0) return [];

    const scenarioIds = assignments.map(
      (a) => a.organizationScenario.scenarioId,
    );
    const sessions = await this.prisma.investigationSession.findMany({
      where: { userId: user.id, scenarioId: { in: scenarioIds } },
      select: {
        scenarioId: true,
        status: true,
        startedAt: true,
        score: { select: { overallPercent: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    const latestByScenario = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      if (!latestByScenario.has(s.scenarioId))
        latestByScenario.set(s.scenarioId, s);
    }

    return assignments.map((a) => {
      const os = a.organizationScenario;
      const session = latestByScenario.get(os.scenarioId);
      return {
        assignmentId: a.id,
        scenarioId: os.scenario.id,
        scenarioSlug: os.scenario.slug,
        title: os.scenario.title,
        category: os.scenario.category,
        difficulty: os.scenario.difficulty,
        estimatedMinutes: os.scenario.estimatedMinutes,
        organizationName: os.org.name,
        assignedAt: a.assignedAt,
        dueAt: os.dueAt,
        status: computeAssignmentStatus(session, os.dueAt),
        scorePercent: session?.score
          ? Number(session.score.overallPercent)
          : null,
      };
    });
  }
}

function computeAssignmentStatus(
  session: { status: string } | undefined,
  dueAt: Date | null,
): 'assigned' | 'in_progress' | 'completed' | 'overdue' {
  if (session?.status === 'scored') return 'completed';
  if (session?.status === 'active' || session?.status === 'submitted') {
    return 'in_progress';
  }
  if (dueAt && dueAt.getTime() < Date.now()) return 'overdue';
  return 'assigned';
}

function toAdminScenarioRowDto(row: {
  id: string;
  scenarioId: string;
  dueAt: Date | null;
  addedAt: Date;
  scenario: {
    title: string;
    difficulty: string;
    category: string;
    estimatedMinutes: number;
  };
  _count: { assignments: number };
}) {
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    title: row.scenario.title,
    difficulty: row.scenario.difficulty,
    category: row.scenario.category,
    estimatedMinutes: row.scenario.estimatedMinutes,
    assignedCount: row._count.assignments,
    dueAt: row.dueAt,
    addedAt: row.addedAt,
  };
}
