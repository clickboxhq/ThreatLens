import { apiClient } from "@/lib/api-client";
import type {
  CertificateStats,
  AdminOverview,
  AdminUserRow,
  AdminUserDetail,
  AdminOrgRow,
  AdminOrgDetail,
  AdminCertificateRow,
  AdministratorRow,
  SecurityOverview,
  SecurityEvent,
  PlatformSettings,
  UserAnalytics,
  ProductAnalytics,
  OrganizationAnalytics,
  Paged,
} from "@/types/admin";

// The one place the platform-admin API is called from. Mirrors src/services/*'s thin-wrapper
// convention; kept in a single file because these endpoints share one owner (the admin
// module) and one auth story (platform_admin only).

function qs(params: Record<string, string | number | undefined>): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

// UserListParams has a couple of string-literal fields; widen for the querystring builder.
const asParams = (o: object): Record<string, string | number | undefined> =>
  o as Record<string, string | number | undefined>;

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
  membership?: "individual" | "organization";
  sort?: "newest" | "oldest" | "name" | "lastActive";
}

export const adminService = {
  // Overview + analytics
  overview: () => apiClient.get<AdminOverview>("/admin/analytics/overview"),
  userAnalytics: () => apiClient.get<UserAnalytics>("/admin/analytics/users"),
  productAnalytics: () => apiClient.get<ProductAnalytics>("/admin/analytics/product"),
  organizationAnalytics: () =>
    apiClient.get<OrganizationAnalytics>("/admin/analytics/organizations"),

  // Users
  listUsers: (p: UserListParams) =>
    apiClient.get<Paged<AdminUserRow>>(`/admin/users${qs(asParams(p))}`),
  getUser: (id: string) => apiClient.get<AdminUserDetail>(`/admin/users/${id}`),
  setUserStatus: (id: string, status: "active" | "suspended") =>
    apiClient.patch<{ id: string; status: string }>(`/admin/users/${id}/status`, { status }),
  resetUserMfa: (id: string) =>
    apiClient.post<{ id: string; mfaEnabled: boolean }>(`/admin/users/${id}/reset-mfa`),

  // Organizations
  listOrganizations: (p: { page?: number; limit?: number; search?: string; status?: string }) =>
    apiClient.get<Paged<AdminOrgRow>>(`/admin/organizations${qs(p)}`),
  getOrganization: (id: string) => apiClient.get<AdminOrgDetail>(`/admin/organizations/${id}`),
  setOrganizationStatus: (id: string, status: "active" | "suspended") =>
    apiClient.patch<{ id: string; status: string }>(`/admin/organizations/${id}/status`, {
      status,
    }),

  // Certificates
  listCertificates: (p: { page?: number; limit?: number; search?: string; status?: string }) =>
    apiClient.get<Paged<AdminCertificateRow>>(`/admin/certificates${qs(p)}`),
  certificateStats: () => apiClient.get<CertificateStats>("/admin/certificates/stats"),
  revokeCertificate: (id: string, reason?: string) =>
    apiClient.post<{ id: string; status: string }>(`/admin/certificates/${id}/revoke`, {
      reason,
    }),
  reissueCertificate: (id: string) =>
    apiClient.post<{ id: string; status: string }>(`/admin/certificates/${id}/reissue`),

  // Administrators
  listAdministrators: () => apiClient.get<AdministratorRow[]>("/admin/administrators"),
  grantAdministrator: (email: string) =>
    apiClient.post<{ id: string; role: string; changed: boolean }>("/admin/administrators", {
      email,
    }),
  revokeAdministrator: (userId: string) =>
    apiClient.delete<{ id: string; role: string }>(`/admin/administrators/${userId}`),

  // Security
  securityOverview: () => apiClient.get<SecurityOverview>("/admin/security/overview"),
  securityEvents: (p: {
    page?: number;
    limit?: number;
    action?: string;
    from?: string;
    to?: string;
  }) => apiClient.get<Paged<SecurityEvent>>(`/admin/security/events${qs(p)}`),

  // Settings
  getSettings: () => apiClient.get<PlatformSettings>("/admin/settings"),
  updateSettings: (patch: Partial<PlatformSettings>) =>
    apiClient.patch<PlatformSettings>("/admin/settings", patch),
};
