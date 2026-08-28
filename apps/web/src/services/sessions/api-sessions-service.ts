import { apiClient } from "@/lib/api-client";
import type { SessionsService } from "./sessions-service";
import type { SessionListItemDto } from "@/types/socverse-operations";

export const apiSessionsService: SessionsService = {
  listMine: () => apiClient.get<SessionListItemDto[]>("/sessions"),
};
