import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsService } from "@/services/organizations";
import { useAuthStore } from "@/lib/auth-store";
import { queryKeys } from "./query-keys";
import type { CreateAnnouncementInput, InviteRole } from "@/types/threatlens-organizations";

const keys = {
  mine: ["organizations", "mine"] as const,
  members: ["organizations", "mine", "members"] as const,
  invites: ["organizations", "mine", "invites"] as const,
  invitePreview: (token: string) => ["organizations", "invite-preview", token] as const,
  announcementsSent: ["organizations", "mine", "announcements", "sent"] as const,
  announcementsMine: ["announcements", "mine"] as const,
};

export function useMyOrganization() {
  const query = useQuery({
    queryKey: keys.mine,
    queryFn: () => organizationsService.getMine(),
  });
  return { organization: query.data ?? null, isPending: query.isPending, isError: query.isError };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => organizationsService.create(name),
    // create() always promotes the caller to org_admin server-side — the client's cached JWT
    // and stored user still say the old role until this runs, so the very next org-scoped
    // request (listMembers, etc.) would otherwise 403 despite the org having been created.
    onSuccess: async () => {
      await useAuthStore.getState().refreshAfterRoleChange("org_admin");
      queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

export function useRenameOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => organizationsService.rename(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

export function useSetOrgLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => organizationsService.setLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

export function useRemoveOrgLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationsService.removeLogo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

/** Announcements addressed to the current user. Every org member can call this. */
export function useMyAnnouncements() {
  const query = useQuery({
    queryKey: keys.announcementsMine,
    queryFn: () => organizationsService.listMyAnnouncements(),
  });
  return { announcements: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

/** The org's sent history — org_admin only, so gate the query with `enabled`. */
export function useSentAnnouncements(enabled: boolean) {
  const query = useQuery({
    queryKey: keys.announcementsSent,
    queryFn: () => organizationsService.listSentAnnouncements(),
    enabled,
  });
  return { announcements: query.data ?? [], isPending: query.isPending };
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => organizationsService.createAnnouncement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.announcementsSent });
      queryClient.invalidateQueries({ queryKey: keys.announcementsMine });
      // The sender doesn't get a notification for their own announcement, but the
      // count/bell may move for other reasons — cheap to refresh.
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useOrganizationMembers(enabled: boolean) {
  const query = useQuery({
    queryKey: keys.members,
    queryFn: () => organizationsService.listMembers(),
    enabled,
  });
  return { members: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

export function useOrganizationInvites(enabled: boolean) {
  const query = useQuery({
    queryKey: keys.invites,
    queryFn: () => organizationsService.listInvites(),
    enabled,
  });
  return { invites: query.data ?? [], isPending: query.isPending };
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: InviteRole }) =>
      organizationsService.createInvite(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.invites });
      queryClient.invalidateQueries({ queryKey: keys.members });
      queryClient.invalidateQueries({ queryKey: keys.mine });
    },
  });
}

/** Public — no auth required, used before the accept-invite visitor has necessarily logged in. */
export function useInvitePreview(token: string) {
  const query = useQuery({
    queryKey: keys.invitePreview(token),
    queryFn: () => organizationsService.previewInvite(token),
  });
  return { preview: query.data, isPending: query.isPending };
}

export function useAcceptInvite() {
  return useMutation({
    // Same stale-role issue as useCreateOrganization() — the role isn't in acceptInvite()'s
    // own response, so the caller passes the role the invite preview already told it about
    // (it's the exact value the backend just assigned, see organizations.service.ts).
    mutationFn: ({ token }: { token: string; role: InviteRole }) =>
      organizationsService.acceptInvite(token),
    onSuccess: async (_data, variables) => {
      await useAuthStore.getState().refreshAfterRoleChange(variables.role);
    },
  });
}
