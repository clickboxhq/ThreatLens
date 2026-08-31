import { apiClient } from "@/lib/api-client";
import type { VulnerabilitiesService } from "./vulnerabilities-service";
import type { VulnerabilityDto } from "@/types/socverse-operations";

export const apiVulnerabilitiesService: VulnerabilitiesService = {
  list: (sessionId) =>
    apiClient.get<VulnerabilityDto[]>(`/sessions/${sessionId}/vulnerabilities`),

  updateStatus: (sessionId, vulnerabilityId, input) =>
    apiClient.patch<VulnerabilityDto>(
      `/sessions/${sessionId}/vulnerabilities/${vulnerabilityId}/status`,
      input,
    ),
};
