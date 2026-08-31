import { apiClient } from "@/lib/api-client";
import type { NetworkService } from "./network-service";
import type { NetworkEventDto } from "@/types/socverse-operations";

export const apiNetworkService: NetworkService = {
  list: (sessionId) => apiClient.get<NetworkEventDto[]>(`/sessions/${sessionId}/network`),
};
