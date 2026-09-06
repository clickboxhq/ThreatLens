import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { EmailService } from '../../common/email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { cohortInviteEmail } from '../../common/email/email-templates';
import { CohortAccessService } from './cohort-access.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CohortInvite,
  CohortInviteStatus,
  CohortStaffRole,
} from '@prisma/client';

// Long enough to survive a weekend and a missed inbox, short enough that a forwarded link does
// not stay live for a whole term. Matches the organisation invite already in the product.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Inviting people into a cohort by email.
 *
 * A cohort already has a join code, but a code is a shared secret: anyone who receives it can
 * pass it on, it cannot be withdrawn from one person, and it leaves no record of who was meant
 * to be there. An invite names an address, can be revoked, expires by itself, and says who sent
 * it — which is what a class roster actually needs.
 *
 * Both are kept. The code stays the right tool for reading out to a room; the invite is the
 * right tool for a list of names.
 */
@Injectable()
export class CohortInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cohortAccess: CohortAccessService,
    private readonly auditLog: AuditLogService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthenticatedUser, cohortId: string) {
    await this.cohortAccess.requireAccess(cohortId, user);
    const invites = await this.prisma.cohortInvite.findMany({
      where: { cohortId },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((i) => this.toDto(i));
  }

  async create(
    user: AuthenticatedUser,
    cohortId: string,
    email: string,
    groupId?: string | null,
    staffRole?: CohortStaffRole | null,
  ) {
    // Inviting somebody onto the teaching staff is a lead's decision, exactly as adding an
    // existing account to the staff list is. Inviting a student needs only tutor.
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      staffRole ? 'lead' : 'tutor',
    );
    const address = email.trim().toLowerCase();

    // A group tutor may only pull people into groups they actually run, and may not invite
    // into the cohort at large — the same narrowing that applies to their assignments. They
    // cannot reach here for a staff invite at all, since that requires lead.
    if (access.groupScoped) {
      if (!groupId) {
        throw new AppException(
          403,
          'GROUP_REQUIRED',
          'You can only invite people into a group you run.',
        );
      }
      if (!access.groupIds.includes(groupId)) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'You can only invite people into a group you run.',
        );
      }
    }

    if (groupId) {
      const group = await this.prisma.cohortGroup.findFirst({
        where: { id: groupId, cohortId },
      });
      if (!group) throw new AppException(404, 'NOT_FOUND', 'Group not found.');
    }

    // Already in the cohort — inviting again would send a link that only ever says "you are
    // already enrolled". Say so now, to the person who can act on it.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: address },
      select: { id: true },
    });
    if (existingUser) {
      const enrolled = await this.prisma.cohortEnrollment.findUnique({
        where: { cohortId_userId: { cohortId, userId: existingUser.id } },
      });
      if (enrolled) {
        throw new AppException(
          409,
          'ALREADY_ENROLLED',
          'That person is already enrolled in this cohort.',
        );
      }
    }

    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: { name: true },
    });
    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { displayName: true },
    });

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    // Re-inviting the same address reissues rather than accumulating. Every previously mailed
    // link for this cohort and address stops working, which is what somebody expects when they
    // send a fresh one.
    const invite = await this.prisma.cohortInvite.upsert({
      where: { cohortId_email: { cohortId, email: address } },
      create: {
        cohortId,
        email: address,
        groupId: groupId ?? null,
        staffRole: staffRole ?? null,
        token,
        invitedBy: user.id,
        expiresAt,
      },
      update: {
        token,
        groupId: groupId ?? null,
        staffRole: staffRole ?? null,
        status: 'pending',
        invitedBy: user.id,
        expiresAt,
        acceptedAt: null,
        createdAt: new Date(),
      },
      include: { group: { select: { id: true, name: true } } },
    });

    const webOrigin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173';
    await this.email.send({
      to: address,
      ...cohortInviteEmail({
        cohortName: cohort.name,
        inviterName: inviter.displayName,
        groupName: invite.group?.name ?? null,
        joinUrl: `${webOrigin}/join-cohort/${token}`,
        hasAccount: Boolean(existingUser),
        staffRole: staffRole ?? null,
      }),
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_invite_sent',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: {
        email: address,
        groupId: groupId ?? null,
        staffRole: staffRole ?? null,
      },
    });

    return this.toDto(invite);
  }

  async revoke(user: AuthenticatedUser, cohortId: string, inviteId: string) {
    await this.cohortAccess.requireAccess(cohortId, user, 'tutor');
    const invite = await this.prisma.cohortInvite.findFirst({
      where: { id: inviteId, cohortId },
    });
    if (!invite) throw new AppException(404, 'NOT_FOUND', 'Invite not found.');
    if (invite.status === 'accepted') {
      throw new AppException(
        409,
        'ALREADY_ACCEPTED',
        'That invite has already been accepted. Remove them from the roster instead.',
      );
    }

    // Cleared, not just marked — a revoked invite whose token still resolves is a door that
    // looks shut.
    await this.prisma.cohortInvite.update({
      where: { id: inviteId },
      data: {
        status: 'revoked',
        token: `revoked:${randomBytes(16).toString('hex')}`,
      },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_invite_revoked',
      targetType: 'cohort',
      targetId: cohortId,
      metadata: { email: invite.email },
    });

    return this.list(user, cohortId);
  }

  /**
   * Unauthenticated: the join page has to say what the invitation is for before the visitor
   * has necessarily signed in, and often before they have an account at all.
   *
   * It deliberately returns nothing about the cohort beyond its name and who invited them —
   * a token is guessable in principle, and this endpoint answers to anybody holding one.
   */
  async preview(token: string) {
    const invite = await this.prisma.cohortInvite.findUnique({
      where: { token },
      include: {
        cohort: { select: { name: true } },
        group: { select: { name: true } },
        inviter: { select: { displayName: true } },
      },
    });
    if (!invite) throw new AppException(404, 'NOT_FOUND', 'Invite not found.');

    const account = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });

    return {
      cohortName: invite.cohort.name,
      groupName: invite.group?.name ?? null,
      inviterName: invite.inviter.displayName,
      email: invite.email,
      staffRole: invite.staffRole,
      status: this.effectiveStatus(invite),
      // Lets the page offer "sign in" or "create an account" as the primary action rather
      // than showing both and making the visitor work out which one applies to them.
      hasAccount: Boolean(account),
    };
  }

  async accept(user: AuthenticatedUser, token: string) {
    const invite = await this.prisma.cohortInvite.findUnique({
      where: { token },
      include: { cohort: { select: { id: true, name: true } } },
    });
    if (!invite) throw new AppException(404, 'NOT_FOUND', 'Invite not found.');

    const status = this.effectiveStatus(invite);
    if (status !== 'pending') {
      throw new AppException(
        409,
        'INVITE_NOT_PENDING',
        status === 'accepted'
          ? 'This invite has already been used.'
          : 'This invite is no longer valid. Ask for a new one.',
      );
    }

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, email: true, displayName: true, role: true },
    });
    if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppException(
        403,
        'EMAIL_MISMATCH',
        `This invite was sent to ${invite.email}. Sign in with that address to accept it.`,
      );
    }

    if (invite.staffRole) {
      return this.acceptAsStaff(invite, me);
    }

    const already = await this.prisma.cohortEnrollment.findUnique({
      where: { cohortId_userId: { cohortId: invite.cohortId, userId: me.id } },
    });
    if (already) {
      // Not an error worth blocking on — mark the invite done and let them through, since the
      // outcome they wanted is already true.
      await this.prisma.cohortInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      return { cohortId: invite.cohortId, cohortName: invite.cohort.name };
    }

    await this.prisma.$transaction([
      this.prisma.cohortEnrollment.create({
        data: {
          cohortId: invite.cohortId,
          userId: me.id,
          groupId: invite.groupId,
          status: 'active',
        },
      }),
      this.prisma.cohortInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: me.id,
      action: 'cohort_invite_accepted',
      targetType: 'cohort',
      targetId: invite.cohortId,
    });

    await this.notifications.create({
      userId: invite.invitedBy,
      category: 'cohort_invitation',
      title: `${me.displayName} joined ${invite.cohort.name}`,
      body: `${me.displayName} (${me.email}) accepted your invitation.`,
      link: '/app/instructor',
    });

    return { cohortId: invite.cohortId, cohortName: invite.cohort.name };
  }

  /**
   * Accepting a staff invitation.
   *
   * The student check is the same one addStaff applies to an existing account, and it has to
   * live here too: an invitation is sent to an address, and whoever signs up with that address
   * chooses their own account type. Refusing rather than promoting keeps the rule in one
   * place — an invite grants a role on this cohort, never a different kind of account.
   */
  private async acceptAsStaff(
    invite: {
      id: string;
      cohortId: string;
      staffRole: CohortStaffRole | null;
      invitedBy: string;
      cohort: { name: string };
    },
    me: { id: string; email: string; displayName: string; role: string },
  ) {
    if (me.role === 'student') {
      throw new AppException(
        403,
        'NOT_AN_INSTRUCTOR',
        'This invitation is for a teaching role, but your account is a student account. Ask for a student invitation instead, or sign up with an instructor account.',
      );
    }

    const existing = await this.prisma.cohortStaff.findUnique({
      where: { cohortId_userId: { cohortId: invite.cohortId, userId: me.id } },
    });

    await this.prisma.$transaction([
      ...(existing
        ? []
        : [
            this.prisma.cohortStaff.create({
              data: {
                cohortId: invite.cohortId,
                userId: me.id,
                role: invite.staffRole!,
                addedBy: invite.invitedBy,
              },
            }),
          ]),
      this.prisma.cohortInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: me.id,
      action: 'cohort_staff_invite_accepted',
      targetType: 'cohort',
      targetId: invite.cohortId,
      metadata: { role: invite.staffRole },
    });

    await this.notifications.create({
      userId: invite.invitedBy,
      category: 'cohort_invitation',
      title: `${me.displayName} joined ${invite.cohort.name}`,
      body: `${me.displayName} (${me.email}) accepted your invitation to teach as ${invite.staffRole === 'lead' ? 'a lead' : invite.staffRole === 'tutor' ? 'a tutor' : 'a group tutor'}.`,
      link: '/app/cohorts',
    });

    return { cohortId: invite.cohortId, cohortName: invite.cohort.name };
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Expiry is a stored timestamp rather than a status the database updates, so a row can read
   * 'pending' long after it stopped working. Every read goes through here so the two never
   * disagree in front of a user.
   */
  private effectiveStatus(invite: {
    status: CohortInviteStatus;
    expiresAt: Date;
  }): CohortInviteStatus | 'expired' {
    if (invite.status !== 'pending') return invite.status;
    return invite.expiresAt.getTime() < Date.now() ? 'expired' : 'pending';
  }

  private toDto(
    invite: CohortInvite & { group?: { id: string; name: string } | null },
  ) {
    return {
      id: invite.id,
      email: invite.email,
      groupId: invite.groupId,
      groupName: invite.group?.name ?? null,
      staffRole: invite.staffRole,
      status: this.effectiveStatus(invite),
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
    };
  }
}
