import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vulnerabilitiesService } from "@/services/vulnerabilities";
import type { VulnerabilityStatus } from "@/types/socverse-operations";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "vulnerabilities"] as const,
};

export function useVulnerabilities(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["vulnerabilities", "none"],
    queryFn: () => vulnerabilitiesService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useUpdateVulnerabilityStatus(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      vulnerabilityId,
      status,
      statusNote,
    }: {
      vulnerabilityId: string;
      status: VulnerabilityStatus;
      statusNote?: string;
    }) => vulnerabilitiesService.updateStatus(sessionId!, vulnerabilityId, { status, statusNote }),
    onSuccess: () => {
      if (sessionId) queryClient.invalidateQueries({ queryKey: keys.list(sessionId) });
    },
  });
}
