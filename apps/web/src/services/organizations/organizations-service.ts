import type {
  AnnouncementDto,
  CreateAnnouncementInput,
  InvitePreviewDto,
  InviteRole,
  OrganizationDto,
  OrganizationInviteDto,
  OrganizationMemberDto,
} from "@/types/threatlens-organizations";

export interface OrganizationsService {
  create(name: string): Promise<OrganizationDto>;
  getMine(): Promise<OrganizationDto | null>;
  rename(name: string, opts?: { teamSize?: number; industry?: string }): Promise<OrganizationDto>;
  setLogo(file: File): Promise<OrganizationDto>;
  removeLogo(): Promise<OrganizationDto>;
  listMembers(): Promise<OrganizationMemberDto[]>;
  /** org_admin: temporarily block a member's organization access. Reversible. */
  suspendMember(userId: string): Promise<void>;
  /** org_admin: the inverse of suspendMember. */
  restoreMember(userId: string): Promise<void>;
  /** org_admin: revoke a member's organization access. Their personal account is preserved. */
  removeMember(userId: string): Promise<void>;
  listInvites(): Promise<OrganizationInviteDto[]>;
  createInvite(email: string, role: InviteRole): Promise<OrganizationInviteDto>;
  /** org_admin: reissue and re-send a pending invite. */
  resendInvite(inviteId: string): Promise<OrganizationInviteDto>;
  /** org_admin: cancel a pending invite. */
  revokeInvite(inviteId: string): Promise<void>;
  /** Unauthenticated on the backend — used by the public accept-invite page. */
  previewInvite(token: string): Promise<InvitePreviewDto | null>;
  acceptInvite(token: string): Promise<OrganizationDto>;
  /** org_admin: send a broadcast to the whole org or one cohort. */
  createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementDto>;
  /** org_admin: announcements this org has sent. */
  listSentAnnouncements(): Promise<AnnouncementDto[]>;
  /** Any member: announcements addressed to them. */
  listMyAnnouncements(): Promise<AnnouncementDto[]>;
  /** org_admin: clear one previously sent announcement. */
  deleteAnnouncement(id: string): Promise<void>;
}
