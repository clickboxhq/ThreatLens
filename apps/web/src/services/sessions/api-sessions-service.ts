import { apiClient } from "@/lib/api-client";
import type { SessionsService } from "./sessions-service";
import type { SessionListItemDto, SkillRadarEntryDto } from "@/types/socverse-operations";

export const apiSessionsService: SessionsService = {
  listMine: () => apiClient.get<SessionListItemDto[]>("/sessions"),
  getSkillRadar: () => apiClient.get<SkillRadarEntryDto[]>("/sessions/skill-radar"),
};
