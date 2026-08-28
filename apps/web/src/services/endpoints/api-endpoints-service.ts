import { apiClient } from "@/lib/api-client";
import type { EndpointsService } from "./endpoints-service";
import type { DeviceDto } from "@/types/socverse-operations";

export const apiEndpointsService: EndpointsService = {
  list: (sessionId) => apiClient.get<DeviceDto[]>(`/sessions/${sessionId}/devices`),

  isolate: (sessionId, deviceId) =>
    apiClient.post<DeviceDto>(`/sessions/${sessionId}/devices/${deviceId}/isolate`),
};
