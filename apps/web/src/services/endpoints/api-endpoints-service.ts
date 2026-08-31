import { apiClient } from "@/lib/api-client";
import type { EndpointsService } from "./endpoints-service";
import type {
  DeviceDto,
  ProcessTreeNodeDto,
  FileEventDto,
  NetworkEventDto,
  HttpRequestDto,
  EntityInsightDto,
} from "@/types/threatlens-operations";

export const apiEndpointsService: EndpointsService = {
  list: (sessionId) => apiClient.get<DeviceDto[]>(`/sessions/${sessionId}/devices`),

  getProfile: (sessionId, deviceId) =>
    apiClient.get<DeviceDto>(`/sessions/${sessionId}/devices/${deviceId}`),

  getProcessTree: (sessionId, deviceId) =>
    apiClient.get<ProcessTreeNodeDto[]>(`/sessions/${sessionId}/devices/${deviceId}/process-tree`),

  getFiles: (sessionId, deviceId) =>
    apiClient.get<FileEventDto[]>(`/sessions/${sessionId}/devices/${deviceId}/files`),

  getNetwork: (sessionId, deviceId) =>
    apiClient.get<NetworkEventDto[]>(`/sessions/${sessionId}/devices/${deviceId}/network`),

  getHttpRequests: (sessionId, deviceId) =>
    apiClient.get<HttpRequestDto[]>(`/sessions/${sessionId}/devices/${deviceId}/http-requests`),

  getInsights: (sessionId, deviceId) =>
    apiClient.get<EntityInsightDto[]>(`/sessions/${sessionId}/devices/${deviceId}/insights`),

  isolate: (sessionId, deviceId) =>
    apiClient.post<DeviceDto>(`/sessions/${sessionId}/devices/${deviceId}/isolate`),
};
