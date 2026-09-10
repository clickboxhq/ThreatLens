import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { adminService, type UserListParams } from "@/services/admin/admin-service";
import type { PlatformSettings } from "@/types/admin";

const KEY = ["admin"] as const;

const noRetry = { retry: false } as const;

export function useAdminOverview() {
  return useQuery({ queryKey: [...KEY, "overview"], queryFn: adminService.overview, ...noRetry });
}
export function useUserAnalytics() {
  return useQuery({
    queryKey: [...KEY, "analytics", "users"],
    queryFn: adminService.userAnalytics,
    ...noRetry,
  });
}
export function useProductAnalytics() {
  return useQuery({
    queryKey: [...KEY, "analytics", "product"],
    queryFn: adminService.productAnalytics,
    ...noRetry,
  });
}
export function useOrgAnalytics() {
  return useQuery({
    queryKey: [...KEY, "analytics", "organizations"],
    queryFn: adminService.organizationAnalytics,
    ...noRetry,
  });
}

export function useAdminUsers(params: UserListParams) {
  return useQuery({
    queryKey: [...KEY, "users", params],
    queryFn: () => adminService.listUsers(params),
    placeholderData: keepPreviousData,
    ...noRetry,
  });
}
export function useAdminUser(id: string) {
  return useQuery({
    queryKey: [...KEY, "users", id],
    queryFn: () => adminService.getUser(id),
    ...noRetry,
  });
}

export function useAdminOrganizations(params: { page: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: [...KEY, "organizations", params],
    queryFn: () => adminService.listOrganizations(params),
    placeholderData: keepPreviousData,
    ...noRetry,
  });
}
export function useAdminOrganization(id: string) {
  return useQuery({
    queryKey: [...KEY, "organizations", id],
    queryFn: () => adminService.getOrganization(id),
    ...noRetry,
  });
}

export function useAdminCertificates(params: { page: number; search?: string; status?: string }) {
  return useQuery({
    queryKey: [...KEY, "certificates", params],
    queryFn: () => adminService.listCertificates(params),
    placeholderData: keepPreviousData,
    ...noRetry,
  });
}

export function useCertificateStats() {
  return useQuery({
    queryKey: [...KEY, "certificate-stats"],
    queryFn: adminService.certificateStats,
    ...noRetry,
  });
}

export function useAdministrators() {
  return useQuery({
    queryKey: [...KEY, "administrators"],
    queryFn: adminService.listAdministrators,
    ...noRetry,
  });
}

export function useSecurityOverview() {
  return useQuery({
    queryKey: [...KEY, "security", "overview"],
    queryFn: adminService.securityOverview,
    ...noRetry,
  });
}
export function useSecurityEvents(params: {
  page: number;
  action?: string;
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: [...KEY, "security", "events", params],
    queryFn: () => adminService.securityEvents(params),
    placeholderData: keepPreviousData,
    ...noRetry,
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: [...KEY, "settings"],
    queryFn: adminService.getSettings,
    ...noRetry,
  });
}

// ---- mutations ------------------------------------------------------------

function useAdminMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { success: string; invalidate: unknown[][] },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(opts.success);
      for (const key of opts.invalidate) qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong.");
    },
  });
}

export const useSetUserStatus = () =>
  useAdminMutation(
    (v: { id: string; status: "active" | "suspended" }) =>
      adminService.setUserStatus(v.id, v.status),
    {
      success: "User status updated",
      invalidate: [
        [...KEY, "users"],
        [...KEY, "overview"],
      ],
    },
  );

export const useResetUserMfa = () =>
  useAdminMutation((id: string) => adminService.resetUserMfa(id), {
    success: "MFA reset — the user will re-enrol on next sign-in",
    invalidate: [
      [...KEY, "users"],
      [...KEY, "security"],
    ],
  });

export const useSetOrgStatus = () =>
  useAdminMutation(
    (v: { id: string; status: "active" | "suspended" }) =>
      adminService.setOrganizationStatus(v.id, v.status),
    {
      success: "Organization status updated",
      invalidate: [
        [...KEY, "organizations"],
        [...KEY, "overview"],
      ],
    },
  );

export const useRevokeCertificate = () =>
  useAdminMutation(
    (v: { id: string; reason?: string }) => adminService.revokeCertificate(v.id, v.reason),
    { success: "Certificate revoked", invalidate: [[...KEY, "certificates"]] },
  );
export const useReissueCertificate = () =>
  useAdminMutation((id: string) => adminService.reissueCertificate(id), {
    success: "Certificate reissued",
    invalidate: [[...KEY, "certificates"]],
  });

export const useGrantAdministrator = () =>
  useAdminMutation((email: string) => adminService.grantAdministrator(email), {
    success: "Platform administrator added",
    invalidate: [
      [...KEY, "administrators"],
      [...KEY, "overview"],
    ],
  });
export const useRevokeAdministrator = () =>
  useAdminMutation((userId: string) => adminService.revokeAdministrator(userId), {
    success: "Platform administrator removed",
    invalidate: [
      [...KEY, "administrators"],
      [...KEY, "overview"],
    ],
  });

export const useUpdateSettings = () =>
  useAdminMutation((patch: Partial<PlatformSettings>) => adminService.updateSettings(patch), {
    success: "Settings saved",
    invalidate: [[...KEY, "settings"]],
  });
