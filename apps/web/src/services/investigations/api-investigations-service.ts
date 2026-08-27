import { apiClient, ApiError } from "@/lib/api-client";
import type { InvestigationsService } from "./investigations-service";
import type {
  EvidenceItemDto,
  HintDto,
  IncidentDto,
  IncidentSummaryDto,
  MitreTechniqueDto,
  NoteDto,
  ScoreDto,
  SearchResultItem,
  SessionDto,
  TimelineItemDto,
} from "@/types/socverse-investigation";

export const apiInvestigationsService: InvestigationsService = {
  createSession: (scenarioId) => apiClient.post<SessionDto>("/sessions", { scenarioId }),

  getSession: (sessionId) => apiClient.get<SessionDto>(`/sessions/${sessionId}`),

  createIncident: (sessionId, title) =>
    apiClient.post<IncidentDto>(`/sessions/${sessionId}/incidents`, { title }),

  listIncidents: (sessionId) =>
    apiClient.get<IncidentSummaryDto[]>(`/sessions/${sessionId}/incidents`),

  getIncident: (sessionId, incidentId) =>
    apiClient.get<IncidentDto>(`/sessions/${sessionId}/incidents/${incidentId}`),

  closeIncident: (sessionId, incidentId, input) =>
    apiClient.post<IncidentDto>(`/sessions/${sessionId}/incidents/${incidentId}/close`, input),

  listEvidence: (sessionId, incidentId) =>
    apiClient.get<EvidenceItemDto[]>(`/sessions/${sessionId}/incidents/${incidentId}/evidence`),

  pinEvidence: (sessionId, incidentId, input) =>
    apiClient.post<EvidenceItemDto>(
      `/sessions/${sessionId}/incidents/${incidentId}/evidence`,
      input,
    ),

  removeEvidence: async (sessionId, incidentId, evidenceId) => {
    await apiClient.delete(`/sessions/${sessionId}/incidents/${incidentId}/evidence/${evidenceId}`);
  },

  getTimeline: (sessionId, incidentId) =>
    apiClient.get<TimelineItemDto[]>(`/sessions/${sessionId}/incidents/${incidentId}/timeline`),

  addToTimeline: (sessionId, incidentId, input) =>
    apiClient.post<TimelineItemDto>(
      `/sessions/${sessionId}/incidents/${incidentId}/timeline`,
      input,
    ),

  removeFromTimeline: async (sessionId, incidentId, eventTable, eventId) => {
    await apiClient.delete(
      `/sessions/${sessionId}/incidents/${incidentId}/timeline/${eventTable}/${eventId}`,
    );
  },

  listNotes: (sessionId, incidentId) =>
    apiClient.get<NoteDto[]>(`/sessions/${sessionId}/incidents/${incidentId}/notes`),

  addNote: (sessionId, incidentId, body) =>
    apiClient.post<NoteDto>(`/sessions/${sessionId}/incidents/${incidentId}/notes`, { body }),

  listHints: (sessionId) => apiClient.get<HintDto[]>(`/sessions/${sessionId}/hints`),

  unlockHint: (sessionId, index) =>
    apiClient.post<HintDto[]>(`/sessions/${sessionId}/hints/${index}/unlock`),

  logResponseAction: async (sessionId, incidentId, actionType, targetType) => {
    await apiClient.post(`/sessions/${sessionId}/incidents/${incidentId}/actions`, {
      actionType,
      targetType,
    });
  },

  search: async (sessionId, input) => {
    const { results } = await apiClient.post<{ results: SearchResultItem[] }>(
      `/sessions/${sessionId}/search`,
      input,
    );
    return results;
  },

  listMitreTechniques: () => apiClient.get<MitreTechniqueDto[]>("/mitre-techniques"),

  submitSession: async (sessionId, incidentIds) => {
    await apiClient.post(`/sessions/${sessionId}/submit`, { incidentIds });
  },

  getScore: async (sessionId) => {
    try {
      return await apiClient.get<ScoreDto>(`/sessions/${sessionId}/score`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_SCORED_YET") return null;
      throw err;
    }
  },
};
