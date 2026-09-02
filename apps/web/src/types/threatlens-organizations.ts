// Types matching SOCVerse's real organizations API (apps/api/src/modules/organizations) — net
// new in Phase 6 of the merge plan. Creating an org promotes the creator to org_admin; there
// is no self-service way to become org_admin any other way (see CreateInviteDto's own comment).

export interface OrganizationDto {
  id: string;
  name: string;
  teamSize?: number | null;
  industry?: string | null;
  memberCount: number;
  createdAt: string;
}

export type OrgMemberRole = "student" | "instructor" | "org_admin" | "platform_admin";
export type OrgMemberStatus = "active" | "suspended" | "pending_verification";

export interface OrganizationMemberDto {
  userId: string;
  displayName: string;
  email: string;
  role: OrgMemberRole;
  status: OrgMemberStatus;
}

export type InviteRole = "student" | "instructor";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface OrganizationInviteDto {
  id: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
}

/** Returned by the unauthenticated preview endpoint the accept-invite page hits before the
 * visitor has necessarily logged in — deliberately minimal, same spirit as certificate
 * verification. */
export interface InvitePreviewDto {
  organizationName: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
}
