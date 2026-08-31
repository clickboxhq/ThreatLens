import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CreateInviteDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organizations.dto';

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
        data: { orgId, role: 'org_admin' },
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
      status: m.status,
    }));
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

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    const inviteUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/accept-invite/${token}`;
    await this.emailService.send({
      to: dto.email,
      subject: `You've been invited to join ${org.name} on ThreatLens`,
      html: `<p>You've been invited to join <strong>${org.name}</strong> on ThreatLens as a${dto.role === 'instructor' ? 'n' : ''} ${dto.role}.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p><p>This invite expires in 7 days.</p>`,
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_sent',
      targetType: 'organization',
      targetId: orgId,
      metadata: { email: dto.email, role: dto.role },
    });

    return toInviteDto(invite);
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
        data: { orgId: invite.organizationId, role: invite.role },
      }),
      this.prisma.organizationInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'organization_invite_accepted',
      targetType: 'organization',
      targetId: invite.organizationId,
    });

    await this.notificationsService.create({
      userId: invite.invitedBy,
      category: 'org_invitation',
      title: `${me.displayName} joined your organization`,
      body: `${me.displayName} (${me.email}) accepted your invite as ${invite.role === 'instructor' ? 'an' : 'a'} ${invite.role}.`,
      link: '/app/organizations',
    });

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
