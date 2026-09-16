import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import {
  organizationInviteEmail,
  organizationMemberJoinedEmail,
  organizationAnnouncementEmail,
} from '../../common/email/email-templates';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationScenariosService } from './organization-scenarios.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CreateAnnouncementDto,
  CreateInviteDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';

const ANNOUNCEMENT_LIST_LIMIT = 50;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — long enough to reach someone over a
// weekend, unlike the auth flows' much shorter security-sensitive windows.

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly organizationScenariosService: OrganizationScenariosService,
  ) {}

  // Creating an org promotes the creator to org_admin — a deliberate, explicit action
  // distinct from signup's own role choice (student|instructor only, see SignupDto), the
  // same way GitHub/Slack/Stripe treat "create an org" as instantly granting its ownership.
  // Restricted to instructor/org_admin callers: letting a plain student self-promote to
  // org_admin (which can invite others as instructor) by hitting this one endpoint would be
  // a real privilege-escalation path, not just an odd UX choice.
  async create(user: AuthenticatedUser, dto: CreateOrganizationDto) {
    if (user.role !== 'instructor' && user.role !== 'org_admin') {
      throw new AppException(
        403,
        'FORBIDDEN',
        'Only an instructor account can create an organization.',
      );
    }

    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (existing.orgId) {
      throw new AppException(
        409,
        'ALREADY_IN_ORGANIZATION',
        'You already belong to an organization.',
      );
    }

    // Pre-generated so both statements in the array-form transaction can reference it — the
    // rest of this codebase avoids the callback-form $transaction(async (tx) => ...) entirely
    // (see e.g. instructor.service.ts, auth.service.ts), same convention alert-engine/rules.ts
    // already uses for exactly this reason.
    const orgId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.organization.create({ data: { id: orgId, name: dto.name } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { orgId, role: 'org_admin', orgJoinedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_created',
      targetType: 'organization',
      targetId: orgId,
      metadata: { name: dto.name },
    });

    return this.toOrgDto(orgId);
  }

  async getMine(user: AuthenticatedUser) {
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
    return this.toOrgDto(me.orgId);
  }

  async rename(user: AuthenticatedUser, dto: UpdateOrganizationDto) {
    const orgId = await this.getOwnedOrgId(user);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: dto.name,
        ...(dto.teamSize !== undefined && { teamSize: dto.teamSize }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
      },
    });
    return this.toOrgDto(orgId);
  }

  /**
   * Set or replace the organisation logo. `getOwnedOrgId` is the security
   * boundary — it rejects anyone who is not the org_admin of an organisation,
   * so a member or a foreign org_admin can never reach another org's row.
   */
  async setLogo(user: AuthenticatedUser, dataUrl: string) {
    const orgId = await this.getOwnedOrgId(user);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { logoDataUrl: dataUrl },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_logo_updated',
      targetType: 'organization',
      targetId: orgId,
    });
    return this.toOrgDto(orgId);
  }

  async removeLogo(user: AuthenticatedUser) {
    const orgId = await this.getOwnedOrgId(user);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { logoDataUrl: null },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_logo_removed',
      targetType: 'organization',
      targetId: orgId,
    });
    return this.toOrgDto(orgId);
  }

  // ---- Announcements --------------------------------------------------------

  /**
   * org_admin broadcasts to the whole org, or to one cohort within it.
   * `getOwnedOrgId` gates this to the org_admin of an organisation; a cohort
   * target is then re-checked to belong to that same org, so an org_admin can
   * never address a cohort — or anyone — outside their own tenant.
   */
  async createAnnouncement(
    user: AuthenticatedUser,
    dto: CreateAnnouncementDto,
  ) {
    const orgId = await this.getOwnedOrgId(user);

    let cohortId: string | null = null;
    if (dto.cohortId) {
      const cohort = await this.prisma.cohort.findUnique({
        where: { id: dto.cohortId },
        select: { id: true, orgId: true },
      });
      if (!cohort || cohort.orgId !== orgId) {
        throw new AppException(
          404,
          'NOT_FOUND',
          'That cohort is not part of your organization.',
        );
      }
      cohortId = cohort.id;
    }

    const recipientIds = await this.resolveAnnouncementRecipients(
      orgId,
      cohortId,
    );
    // The author does not get notified about their own announcement.
    const notifyIds = recipientIds.filter((id) => id !== user.id);

    const announcement = await this.prisma.announcement.create({
      data: {
        orgId,
        cohortId,
        authorId: user.id,
        title: dto.title,
        body: dto.body,
        recipientCount: notifyIds.length,
      },
    });

    await this.notificationsService.createMany({
      userIds: notifyIds,
      category: 'announcement',
      title: dto.title,
      body: dto.body,
      link: '/app/announcements',
    });

    // §13: the same event that creates the in-app notification also emails every recipient —
    // one source of truth, so this can't drift out of sync with what students see in-app, and
    // reaching them doesn't depend on being signed in when it's sent (EmailService.send()
    // catches and logs its own failures rather than throwing, so a bad address can never roll
    // back the announcement or the notifications already created above).
    if (notifyIds.length > 0) {
      const [author, org, recipients] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { displayName: true },
        }),
        this.prisma.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { name: true },
        }),
        this.prisma.user.findMany({
          where: { id: { in: notifyIds } },
          select: { id: true, email: true, displayName: true },
        }),
      ]);
      const announcementsUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/app/announcements`;
      await Promise.all(
        recipients.map((r) =>
          this.emailService.send({
            to: r.email,
            ...organizationAnnouncementEmail({
              recipientName: r.displayName,
              orgName: org.name,
              authorName: author.displayName,
              title: dto.title,
              body: dto.body,
              announcementsUrl,
            }),
          }),
        ),
      );
    }

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_announcement_sent',
      targetType: 'organization',
      targetId: orgId,
      metadata: {
        announcementId: announcement.id,
        cohortId,
        recipientCount: notifyIds.length,
      },
    });

    return this.toAnnouncementDto(announcement.id);
  }

  /** The org_admin's own "sent" history. */
  async listSentAnnouncements(user: AuthenticatedUser) {
    const orgId = await this.getOwnedOrgId(user);
    const rows = await this.prisma.announcement.findMany({
      where: { orgId, deletedAt: null },
      include: {
        author: { select: { displayName: true } },
        cohort: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: ANNOUNCEMENT_LIST_LIMIT,
    });
    return rows.map(announcementRowToDto);
  }

  /**
   * §12: an org_admin clearing a previously sent announcement. Soft-deletes the
   * Announcement row only — existing Notification rows for it are untouched (they
   * carry their own copy of title/body, not a reference to this row), so recipients
   * keep their notification history and nothing goes "not found" underneath them.
   * `getOwnedOrgId` + the orgId match below are the same two-layer tenant check every
   * other org_admin mutation here uses: an admin can only ever reach their own org's rows.
   */
  async deleteAnnouncement(user: AuthenticatedUser, announcementId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, orgId: true, deletedAt: true },
    });
    if (!announcement || announcement.orgId !== orgId) {
      throw new AppException(404, 'NOT_FOUND', 'Announcement not found.');
    }
    if (announcement.deletedAt) return;

    await this.prisma.announcement.update({
      where: { id: announcementId },
      data: { deletedAt: new Date() },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_announcement_deleted',
      targetType: 'organization',
      targetId: orgId,
      metadata: { announcementId },
    });
  }

  /**
   * Announcements addressed to the caller: everything sent to their whole org
   * (only if they are a formal member of it — `me.orgId` match), plus anything
   * sent to a cohort they are actively enrolled in.
   *
   * The cohort half deliberately does NOT also require `me.orgId` to match: a
   * user can be an active CohortEnrollment member of a cohort under an org
   * without ever being a formal org member themselves (cohort-invite.service.ts's
   * `accept()` creates the enrollment but never touches `user.orgId` — a
   * cohort's own roster and an org's member list are separate lists by design).
   * resolveAnnouncementRecipients (the notification fan-out above) already
   * follows this same rule for cohort-targeted sends, so this read path has to
   * match it or a user can receive the notification for an announcement this
   * query then hides from them — a real symptom previously seen with the
   * ClickBox cohort-only accounts, not a hypothetical.
   */
  async listMyAnnouncements(user: AuthenticatedUser) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { orgId: true, orgMembershipStatus: true },
    });
    // A suspended member keeps the membership row (orgId stays set, so Restore Access can
    // bring them right back) but stops counting as a standing org-wide recipient in the
    // meantime — the same "temporarily prevented from accessing organization resources"
    // this status exists for.
    const orgActive =
      me.orgId && me.orgMembershipStatus === 'active' ? me.orgId : null;

    const enrollments = await this.prisma.cohortEnrollment.findMany({
      where: { userId: user.id, status: 'active' },
      select: { cohortId: true, cohort: { select: { orgId: true } } },
    });
    // If suspended in an org, that org's own cohorts stop counting too — a suspension is
    // meant to cut every resource that org provides, not just the org-wide ones. A cohort
    // under a *different* org (or none) is unaffected: cohort membership there is its own,
    // unrelated access grant, same reasoning as the cohort-only-member case above.
    const cohortIds = enrollments
      .filter((e) => !(me.orgId && !orgActive && e.cohort.orgId === me.orgId))
      .map((e) => e.cohortId);

    if (!orgActive && cohortIds.length === 0) return [];

    const rows = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(orgActive ? [{ orgId: orgActive, cohortId: null }] : []),
          ...(cohortIds.length > 0 ? [{ cohortId: { in: cohortIds } }] : []),
        ],
      },
      include: {
        author: { select: { displayName: true } },
        cohort: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: ANNOUNCEMENT_LIST_LIMIT,
    });
    return rows.map(announcementRowToDto);
  }

  private async resolveAnnouncementRecipients(
    orgId: string,
    cohortId: string | null,
  ): Promise<string[]> {
    if (cohortId) {
      const enrollments = await this.prisma.cohortEnrollment.findMany({
        where: {
          cohortId,
          status: 'active',
          // A cohort member who is also a *suspended* member of this same org (the cohort
          // is already known to belong to it — createAnnouncement checked) doesn't get this
          // send either. A cohort member unrelated to this org — no orgId, or a different
          // one — is untouched, same as everywhere else this distinction is made.
          user: { NOT: { orgId, orgMembershipStatus: 'suspended' } },
        },
        select: { userId: true },
      });
      return enrollments.map((e) => e.userId);
    }
    const members = await this.prisma.user.findMany({
      where: { orgId, orgMembershipStatus: 'active', deletedAt: null },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  private async toAnnouncementDto(id: string) {
    const row = await this.prisma.announcement.findUniqueOrThrow({
      where: { id },
      include: {
        author: { select: { displayName: true } },
        cohort: { select: { name: true } },
      },
    });
    return announcementRowToDto(row);
  }

  async listMembers(user: AuthenticatedUser) {
    const orgId = await this.getOwnedOrgId(user);
    const members = await this.prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.id,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      // Account status (ThreatLens-wide) and org membership status are deliberately separate
      // fields — a suspended-from-the-org member's ThreatLens account is still `active`.
      accountStatus: m.status,
      orgMembershipStatus: m.orgMembershipStatus,
      joinedAt: m.orgJoinedAt,
      lastActiveAt: m.lastLoginAt,
    }));
  }

  /**
   * §11: an org_admin revoking a member's organization access.
   *
   * Three things happen together, in one transaction:
   *  1. `orgId` is cleared — the member's personal account, investigation history, scores
   *     and certificates are untouched (only the org relation is), same as the rest of this
   *     codebase's soft/relational-only removals.
   *  2. Their active enrollments in *this org's* cohorts are dropped, so they stop being a
   *     recipient of this org's cohort-scoped announcements/assignments the moment this
   *     runs — listMyAnnouncements (above) treats an active CohortEnrollment as standing
   *     access independent of `orgId`, so leaving the enrollment active would silently
   *     undo the revocation for anything cohort-scoped.
   *  3. `sessionVersion` is bumped — the same primitive auth.service.ts uses for
   *     logout-all/MFA-change/password-reset. `cohort-access.service.ts` grants an
   *     org_admin cohort access from the *JWT's* cached orgId (not a fresh DB read), and a
   *     plain student's access token is still valid for up to 15 minutes after this call;
   *     bumping the version makes JwtAuthGuard reject that token on its very next request
   *     instead of waiting for it to expire on its own.
   *
   * A history-preserving removal (rather than deleting the CohortEnrollment/CohortStaff
   * rows outright) matches how Cohort.archivedAt already treats past-term data: the record
   * that this person once belonged here survives, only their standing access does not.
   */
  /**
   * §11 shared guard for every member-management action below: an org_admin cannot act on
   * themselves this way (ask another admin), and a member from a different org — or a bogus
   * id — 404s rather than 403s, so this can't be used to probe which ids exist elsewhere.
   */
  private async requireManageableMember(
    user: AuthenticatedUser,
    orgId: string,
    memberId: string,
  ) {
    if (memberId === user.id) {
      throw new AppException(
        400,
        'CANNOT_MANAGE_SELF',
        'You cannot do this to your own membership. Ask another organization admin.',
      );
    }
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        orgId: true,
        email: true,
        displayName: true,
        orgMembershipStatus: true,
      },
    });
    if (!member || member.orgId !== orgId) {
      throw new AppException(
        404,
        'NOT_FOUND',
        'That member is not part of your organization.',
      );
    }
    return member;
  }

  /**
   * §11: temporarily suspend a member's organization access without touching their
   * membership record, ThreatLens account, or history — the reversible middle ground between
   * "active" and "removed". Bumps `sessionVersion` for the same immediate-revocation reason
   * removeMember does (see its own comment): a still-valid access token must stop granting
   * org-scoped access on its very next request, not just once it happens to expire.
   */
  async suspendMember(user: AuthenticatedUser, memberId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const member = await this.requireManageableMember(user, orgId, memberId);
    if (member.orgMembershipStatus === 'suspended') return;

    await this.prisma.user.update({
      where: { id: memberId },
      data: {
        orgMembershipStatus: 'suspended',
        sessionVersion: { increment: 1 },
      },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_member_suspended',
      targetType: 'user',
      targetId: memberId,
      metadata: { orgId, memberEmail: member.email },
    });
  }

  /** §11: the inverse of suspendMember — restores standing access. No session bump needed;
   * this only grants, and every access check re-reads status fresh from the DB anyway. */
  async restoreMember(user: AuthenticatedUser, memberId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const member = await this.requireManageableMember(user, orgId, memberId);
    if (member.orgMembershipStatus === 'active') return;

    await this.prisma.user.update({
      where: { id: memberId },
      data: { orgMembershipStatus: 'active' },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_member_restored',
      targetType: 'user',
      targetId: memberId,
      metadata: { orgId, memberEmail: member.email },
    });
  }

  async removeMember(user: AuthenticatedUser, memberId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const member = await this.requireManageableMember(user, orgId, memberId);

    const orgCohorts = await this.prisma.cohort.findMany({
      where: { orgId },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: memberId },
        data: {
          orgId: null,
          // Reset to a clean slate — a later, unrelated org membership should never inherit
          // this org's suspension state or this org's join date.
          orgMembershipStatus: 'active',
          orgJoinedAt: null,
          sessionVersion: { increment: 1 },
        },
      }),
      this.prisma.cohortEnrollment.updateMany({
        where: {
          userId: memberId,
          cohortId: { in: orgCohorts.map((c) => c.id) },
          status: 'active',
        },
        data: { status: 'dropped' },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_member_removed',
      targetType: 'user',
      targetId: memberId,
      metadata: { orgId, memberEmail: member.email },
    });
  }

  async listInvites(user: AuthenticatedUser) {
    const orgId = await this.getOwnedOrgId(user);
    const invites = await this.prisma.organizationInvite.findMany({
      where: { organizationId: orgId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map(toInviteDto);
  }

  async createInvite(user: AuthenticatedUser, dto: CreateInviteDto) {
    const orgId = await this.getOwnedOrgId(user);

    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (invitee?.orgId === orgId) {
      throw new AppException(
        409,
        'ALREADY_A_MEMBER',
        'This person is already a member of your organization.',
      );
    }

    const token = randomBytes(24).toString('hex');
    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId: orgId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        invitedBy: user.id,
      },
    });

    await this.sendInviteEmail(orgId, user.id, dto.email, dto.role, token);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_sent',
      targetType: 'organization',
      targetId: orgId,
      metadata: { email: dto.email, role: dto.role },
    });

    return toInviteDto(invite);
  }

  /** §Invitation management: cancels a pending invite so its link stops working. Reuses the
   * `revoked` status OrganizationInviteStatus already had — this is the first place that ever
   * sets it. */
  async revokeInvite(user: AuthenticatedUser, inviteId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.organizationId !== orgId) {
      throw new AppException(404, 'NOT_FOUND', 'Invite not found.');
    }
    if (this.effectiveStatus(invite) !== 'pending') {
      throw new AppException(
        409,
        'INVITE_NOT_PENDING',
        'This invite is no longer pending.',
      );
    }

    await this.prisma.organizationInvite.update({
      where: { id: inviteId },
      data: { status: 'revoked' },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_revoked',
      targetType: 'organization',
      targetId: orgId,
      metadata: { inviteId, email: invite.email },
    });
  }

  /** §Invitation management: reissues a fresh token/expiry and re-sends the same branded
   * email — the token in the original message stops working the moment this runs, same as
   * cohort-invite.service.ts's re-invite-reissues convention. */
  async resendInvite(user: AuthenticatedUser, inviteId: string) {
    const orgId = await this.getOwnedOrgId(user);
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.organizationId !== orgId) {
      throw new AppException(404, 'NOT_FOUND', 'Invite not found.');
    }
    if (this.effectiveStatus(invite) !== 'pending') {
      throw new AppException(
        409,
        'INVITE_NOT_PENDING',
        'This invite is no longer pending.',
      );
    }

    const token = randomBytes(24).toString('hex');
    const [updated] = await Promise.all([
      this.prisma.organizationInvite.update({
        where: { id: inviteId },
        data: { token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      }),
      this.sendInviteEmail(orgId, user.id, invite.email, invite.role, token),
    ]);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_resent',
      targetType: 'organization',
      targetId: orgId,
      metadata: { inviteId, email: invite.email },
    });

    return toInviteDto(updated);
  }

  private async sendInviteEmail(
    orgId: string,
    inviterId: string,
    email: string,
    role: string,
    token: string,
  ): Promise<void> {
    const [org, inviter] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: inviterId },
        select: { displayName: true },
      }),
    ]);
    const inviteUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/accept-invite/${token}`;
    await this.emailService.send({
      to: email,
      ...organizationInviteEmail({
        orgName: org.name,
        inviterName: inviter.displayName,
        role,
        inviteUrl,
      }),
    });
  }

  /** Unauthenticated — the accept-invite page needs to show who's inviting whom before the
   * visitor has necessarily logged in, same spirit as the public certificate verify page. */
  async previewInvite(token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invite) throw new AppException(404, 'NOT_FOUND', 'Invite not found.');
    return {
      organizationName: invite.organization.name,
      email: invite.email,
      role: invite.role,
      status: this.effectiveStatus(invite),
    };
  }

  async acceptInvite(user: AuthenticatedUser, token: string) {
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { token },
    });
    if (!invite) throw new AppException(404, 'NOT_FOUND', 'Invite not found.');

    const status = this.effectiveStatus(invite);
    if (status !== 'pending') {
      throw new AppException(
        409,
        'INVITE_NOT_PENDING',
        `This invite has already been ${status}.`,
      );
    }

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppException(
        403,
        'EMAIL_MISMATCH',
        'This invite was sent to a different email address than your account.',
      );
    }
    if (me.orgId) {
      throw new AppException(
        409,
        'ALREADY_IN_ORGANIZATION',
        'You already belong to an organization.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          orgId: invite.organizationId,
          role: invite.role,
          orgJoinedAt: new Date(),
        },
      }),
      this.prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ]);

    // §Task 2: a new member sees every scenario the org is already running, same as if
    // they'd joined before each was added.
    await this.organizationScenariosService.assignAllActiveScenariosToNewMember(
      invite.organizationId,
      user.id,
    );

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_accepted',
      targetType: 'organization',
      targetId: invite.organizationId,
    });

    // §Task 1: everyone who can actually act on this — not just whoever happened to send
    // this particular invite. Today an org has exactly one org_admin (role is never
    // grantable by invite), but this stays correct if that ever changes.
    const [org, admins] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: invite.organizationId },
        select: { name: true },
      }),
      this.prisma.user.findMany({
        where: { orgId: invite.organizationId, role: 'org_admin' },
        select: { id: true, displayName: true, email: true },
      }),
    ]);
    const joinedAt = new Date();

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.create({
          userId: admin.id,
          category: 'org_invitation',
          title: 'New student joined your organization',
          body: `${me.displayName} (${me.email}) has accepted the invitation and joined ${org.name} as ${invite.role === 'instructor' ? 'an' : 'a'} ${invite.role}.`,
          link: '/app/organizations',
        }),
      ),
    );

    // A logged-out admin never sees the in-app notification above, so this is the only
    // channel that reliably reaches them — see organizationMemberJoinedEmail's own comment.
    // EmailService.send() catches and logs its own failures rather than throwing (checked:
    // apps/api/src/common/email/email.service.ts), so a delivery failure here can never roll
    // back the membership transaction that already committed above.
    const membersUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/app/organizations`;
    await Promise.all(
      admins.map((admin) =>
        this.emailService.send({
          to: admin.email,
          ...organizationMemberJoinedEmail({
            adminName: admin.displayName,
            memberName: me.displayName,
            memberEmail: me.email,
            orgName: org.name,
            role: invite.role,
            joinedAt,
            membersUrl,
          }),
        }),
      ),
    );

    return this.toOrgDto(invite.organizationId);
  }

  /** Not persisted as a distinct enum value — an unaccepted invite past its expiresAt is
   * "expired" for display purposes without needing a scheduled job to flip a status column. */
  private effectiveStatus(invite: {
    status: string;
    expiresAt: Date;
  }): 'pending' | 'accepted' | 'revoked' | 'expired' {
    if (invite.status !== 'pending')
      return invite.status as 'accepted' | 'revoked';
    return invite.expiresAt < new Date() ? 'expired' : 'pending';
  }

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

  private async toOrgDto(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: { _count: { select: { users: true } } },
    });
    return {
      id: org.id,
      name: org.name,
      teamSize: org.teamSize,
      industry: org.industry,
      logoDataUrl: org.logoDataUrl,
      memberCount: org._count.users,
      createdAt: org.createdAt,
    };
  }
}

function toInviteDto(invite: {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  };
}

function announcementRowToDto(row: {
  id: string;
  title: string;
  body: string;
  cohortId: string | null;
  recipientCount: number;
  createdAt: Date;
  author: { displayName: string };
  cohort: { name: string } | null;
}) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.cohort
      ? { scope: 'cohort' as const, cohortName: row.cohort.name }
      : { scope: 'organization' as const, cohortName: null },
    authorName: row.author.displayName,
    recipientCount: row.recipientCount,
    createdAt: row.createdAt,
  };
}
