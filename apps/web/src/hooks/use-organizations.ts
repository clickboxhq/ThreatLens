import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsService } from "@/services/organizations";
import type { InviteRole } from "@/types/socverse-organizations";

const keys = {
  mine: ["organizations", "mine"] as const,
  members: ["organizations", "mine", "members"] as const,
  invites: ["organizations", "mine", "invites"] as const,
  invitePreview: (token: string) => ["organizations", "invite-preview", token] as const,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.mine }),
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
    mutationFn: (token: string) => organizationsService.acceptInvite(token),
  });
}
