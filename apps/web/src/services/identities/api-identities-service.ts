import { apiClient } from "@/lib/api-client";
import type { IdentitiesService } from "./identities-service";
import type {
  IdentityDto,
  IdentityProfileDto,
  SignInEventDto,
  CloudEventDto,
  DirectoryAuditEventDto,
  EntityInsightDto,
} from "@/types/socverse-operations";

export const apiIdentitiesService: IdentitiesService = {
  list: (sessionId) => apiClient.get<IdentityDto[]>(`/sessions/${sessionId}/identities`),

  getSignIns: (sessionId, identityId) =>
    apiClient.get<SignInEventDto[]>(`/sessions/${sessionId}/identities/${identityId}/signins`),

  getProfile: (sessionId, identityId) =>
    apiClient.get<IdentityProfileDto>(`/sessions/${sessionId}/identities/${identityId}`),

  getCloudEvents: (sessionId, identityId) =>
    apiClient.get<CloudEventDto[]>(`/sessions/${sessionId}/identities/${identityId}/cloud-events`),

  getAuditEvents: (sessionId, identityId) =>
    apiClient.get<DirectoryAuditEventDto[]>(
      `/sessions/${sessionId}/identities/${identityId}/audit-events`,
    ),

  getInsights: (sessionId, identityId) =>
    apiClient.get<EntityInsightDto[]>(`/sessions/${sessionId}/identities/${identityId}/insights`),
};
