import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpointsService } from "@/services/endpoints";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "devices"] as const,
};

export function useEndpoints(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["devices", "none"],
    queryFn: () => endpointsService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useIsolateDevice(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => endpointsService.isolate(sessionId!, deviceId),
    onSuccess: () => {
      if (sessionId) queryClient.invalidateQueries({ queryKey: keys.list(sessionId) });
    },
  });
}
