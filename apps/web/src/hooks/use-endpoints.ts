import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endpointsService } from "@/services/endpoints";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "devices"] as const,
  profile: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId] as const,
  processTree: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId, "process-tree"] as const,
  files: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId, "files"] as const,
  network: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId, "network"] as const,
  insights: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId, "insights"] as const,
  http: (sessionId: string, deviceId: string) =>
    ["session", sessionId, "devices", deviceId, "http"] as const,
};

export function useEndpoints(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["devices", "none"],
    queryFn: () => endpointsService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useDeviceProfile(sessionId: string, deviceId: string | null) {
  return useQuery({
    queryKey: deviceId ? keys.profile(sessionId, deviceId) : ["device", "none"],
    queryFn: () => endpointsService.getProfile(sessionId, deviceId!),
    enabled: Boolean(deviceId),
  });
}

export function useDeviceProcessTree(sessionId: string, deviceId: string | null) {
  return useQuery({
    queryKey: deviceId ? keys.processTree(sessionId, deviceId) : ["process-tree", "none"],
    queryFn: () => endpointsService.getProcessTree(sessionId, deviceId!),
    enabled: Boolean(deviceId),
  });
}

export function useDeviceFiles(sessionId: string, deviceId: string | null) {
  return useQuery({
    queryKey: deviceId ? keys.files(sessionId, deviceId) : ["files", "none"],
    queryFn: () => endpointsService.getFiles(sessionId, deviceId!),
    enabled: Boolean(deviceId),
  });
}

export function useDeviceNetwork(sessionId: string, deviceId: string | null) {
  return useQuery({
    queryKey: deviceId ? keys.network(sessionId, deviceId) : ["network", "none"],
    queryFn: () => endpointsService.getNetwork(sessionId, deviceId!),
    enabled: Boolean(deviceId),
  });
}

export function useDeviceHttpRequests(sessionId: string, deviceId: string | null) {
  return useQuery({
    queryKey: deviceId ? keys.http(sessionId, deviceId) : ["http", "none"],
    queryFn: () => endpointsService.getHttpRequests(sessionId, deviceId!),
    enabled: Boolean(deviceId),
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

/** Analyst questions for this device — see components/soc/insight-prompts.tsx. */
export function useDeviceInsights(sessionId: string | undefined, deviceId: string | undefined) {
  return useQuery({
    queryKey: sessionId && deviceId ? keys.insights(sessionId, deviceId) : ["insights", "none"],
    queryFn: () => endpointsService.getInsights(sessionId!, deviceId!),
    enabled: Boolean(sessionId && deviceId),
  });
}
