import { apiClient, ApiError } from "@/lib/api-client";
import type { OrganizationsService } from "./organizations-service";
import type {
  InvitePreviewDto,
  InviteRole,
  OrganizationDto,
  OrganizationInviteDto,
  OrganizationMemberDto,
} from "@/types/threatlens-organizations";

export const apiOrganizationsService: OrganizationsService = {
  create: (name) => apiClient.post<OrganizationDto>("/organizations", { name }),

  getMine: async () => {
    try {
      return await apiClient.get<OrganizationDto>("/organizations/mine");
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_IN_ORGANIZATION") return null;
      throw err;
    }
  },

  rename: (name) => apiClient.patch<OrganizationDto>("/organizations/mine", { name }),

  listMembers: () => apiClient.get<OrganizationMemberDto[]>("/organizations/mine/members"),

  listInvites: () => apiClient.get<OrganizationInviteDto[]>("/organizations/mine/invites"),

  createInvite: (email, role) =>
    apiClient.post<OrganizationInviteDto>("/organizations/mine/invites", { email, role }),

  previewInvite: async (token) => {
    try {
      return await apiClient.get<InvitePreviewDto>(`/organizations/invites/${token}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_FOUND") return null;
      throw err;
    }
  },

  acceptInvite: (token) =>
    apiClient.post<OrganizationDto>(`/organizations/invites/${token}/accept`),
};
