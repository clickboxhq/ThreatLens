import { apiClient } from "@/lib/api-client";
import type { SessionsService } from "./sessions-service";
import type {
  ActivityLogDto,
  SessionListItemDto,
  SkillRadarEntryDto,
  TechniqueMasteryEntryDto,
} from "@/types/socverse-operations";

export const apiSessionsService: SessionsService = {
  listMine: () => apiClient.get<SessionListItemDto[]>("/sessions"),
  getSkillRadar: () => apiClient.get<SkillRadarEntryDto[]>("/sessions/skill-radar"),
  getTechniqueMastery: () =>
    apiClient.get<TechniqueMasteryEntryDto[]>("/sessions/technique-mastery"),
  getActivity: (sessionId) => apiClient.get<ActivityLogDto>(`/sessions/${sessionId}/activity`),
};
