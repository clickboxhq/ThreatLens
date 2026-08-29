import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/services/settings";
import { queryKeys } from "./query-keys";

export function useMfaStatus() {
  const query = useQuery({
    queryKey: [...queryKeys.settings, "mfa-status"],
    queryFn: () => settingsService.getMfaStatus(),
  });
  return { status: query.data, isPending: query.isPending };
}

export function useSetupMfa() {
  return useMutation({ mutationFn: () => settingsService.setupMfa() });
}

export function useEnableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => settingsService.enableMfa(code),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...queryKeys.settings, "mfa-status"] }),
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => settingsService.disableMfa(password),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...queryKeys.settings, "mfa-status"] }),
  });
}
