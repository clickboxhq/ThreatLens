import type {
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
  listInvites(): Promise<OrganizationInviteDto[]>;
  createInvite(email: string, role: InviteRole): Promise<OrganizationInviteDto>;
  /** Unauthenticated on the backend — used by the public accept-invite page. */
  previewInvite(token: string): Promise<InvitePreviewDto | null>;
  acceptInvite(token: string): Promise<OrganizationDto>;
}
