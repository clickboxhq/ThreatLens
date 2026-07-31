import { api, downloadFile } from './client';
import type {
  Alert,
  AnalystNote,
  AuthUser,
  Cohort,
  CohortAssignment,
  CohortMembership,
  Device,
  EmailMessage,
  EvidenceItem,
  FileEvent,
  HintItem,
  Identity,
  Incident,
  IncidentSummary,
  InstructorFeedbackItem,
  LeaderboardResult,
  MitreTechniqueRef,
  MyAssignment,
  NetworkEvent,
  ProcessEventNode,
  ReviewQueueItem,
  RosterEntry,
  ScenarioSummary,
  ScoreResult,
  SessionHistoryItem,
  SessionSummary,
  SignIn,
  TokenResponse,
} from './types';

export const authApi = {
  signup: (email: string, password: string, displayName: string, role?: 'student' | 'instructor') =>
    api.post<{ userId: string; emailVerificationRequired: boolean }>('/auth/signup', {
      email,
      password,
      displayName,
      role,
    }),
  login: (email: string, password: string) =>
    api.post<TokenResponse & { user: AuthUser }>('/auth/login', { email, password }),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }),
};

export const scenarioApi = {
  list: () => api.get<ScenarioSummary[]>('/scenarios'),
};

export const sessionApi = {
  create: (scenarioId: string, cohortAssignmentId?: string) =>
    api.post<SessionSummary>('/sessions', { scenarioId, cohortAssignmentId }),
  listMine: () => api.get<SessionHistoryItem[]>('/sessions'),
  get: (sessionId: string) => api.get<SessionSummary>(`/sessions/${sessionId}`),
  submit: (sessionId: string, incidentIds: string[]) =>
    api.post<{ scoringStatus: string }>(`/sessions/${sessionId}/submit`, { incidentIds }),
  getScore: (sessionId: string) => api.get<ScoreResult>(`/sessions/${sessionId}/score`),
};

export const alertsApi = {
  list: (sessionId: string) => api.get<Alert[]>(`/sessions/${sessionId}/alerts`),
  getEvidence: (sessionId: string, alertId: string) =>
    api.get<{ alertId: string; evidence: { eventTable: string; eventId: string; occurredAt: string; summary: string }[] }>(
      `/sessions/${sessionId}/alerts/${alertId}/evidence`,
    ),
  updateStatus: (sessionId: string, alertId: string, status: string, dismissalReason?: string) =>
    api.patch<Alert>(`/sessions/${sessionId}/alerts/${alertId}`, { status, dismissalReason }),
};

export const incidentsApi = {
  list: (sessionId: string) => api.get<IncidentSummary[]>(`/sessions/${sessionId}/incidents`),
  get: (sessionId: string, incidentId: string) => api.get<Incident>(`/sessions/${sessionId}/incidents/${incidentId}`),
  create: (sessionId: string, title: string) => api.post<Incident>(`/sessions/${sessionId}/incidents`, { title }),
  linkAlerts: (sessionId: string, incidentId: string, alertIds: string[]) =>
    api.post<Incident>(`/sessions/${sessionId}/incidents/${incidentId}/alerts`, { alertIds }),
  close: (sessionId: string, incidentId: string, verdict: string, summary: string, mitreTechniqueIds: string[]) =>
    api.post<Incident>(`/sessions/${sessionId}/incidents/${incidentId}/close`, { verdict, summary, mitreTechniqueIds }),
  pinEvidence: (sessionId: string, incidentId: string, eventTable: string, eventId: string, justification: string, mitreTechniqueId?: string) =>
    api.post<EvidenceItem>(`/sessions/${sessionId}/incidents/${incidentId}/evidence`, {
      eventTable,
      eventId,
      justification,
      mitreTechniqueId,
    }),
  listEvidence: (sessionId: string, incidentId: string) =>
    api.get<EvidenceItem[]>(`/sessions/${sessionId}/incidents/${incidentId}/evidence`),
  addNote: (sessionId: string, incidentId: string, body: string) =>
    api.post<AnalystNote>(`/sessions/${sessionId}/incidents/${incidentId}/notes`, { body }),
  listNotes: (sessionId: string, incidentId: string) =>
    api.get<AnalystNote[]>(`/sessions/${sessionId}/incidents/${incidentId}/notes`),
  listFeedback: (sessionId: string, incidentId: string) =>
    api.get<InstructorFeedbackItem[]>(`/sessions/${sessionId}/incidents/${incidentId}/feedback`),
};

export const cohortsApi = {
  join: (joinCode: string) => api.post<{ cohortId: string; cohortName: string }>('/cohorts/join', { joinCode }),
  listMine: () => api.get<CohortMembership[]>('/cohorts/mine'),
  listMyAssignments: () => api.get<MyAssignment[]>('/cohorts/mine/assignments'),
};

export const instructorApi = {
  createCohort: (name: string, startsAt?: string, endsAt?: string) =>
    api.post<Cohort>('/instructor/cohorts', { name, startsAt, endsAt }),
  listCohorts: () => api.get<Cohort[]>('/instructor/cohorts'),
  getRoster: (cohortId: string) => api.get<RosterEntry[]>(`/instructor/cohorts/${cohortId}/roster`),
  createAssignment: (cohortId: string, scenarioId: string, dueAt?: string, attemptLimit?: number) =>
    api.post<CohortAssignment>(`/instructor/cohorts/${cohortId}/assignments`, { scenarioId, dueAt, attemptLimit }),
  listAssignments: (cohortId: string) => api.get<CohortAssignment[]>(`/instructor/cohorts/${cohortId}/assignments`),
  reviewQueue: (cohortId: string) => api.get<ReviewQueueItem[]>(`/instructor/cohorts/${cohortId}/review-queue`),
  submitFeedback: (
    incidentId: string,
    payload: { rubricOverrides?: Record<string, number>; comment?: string; reopenSession?: boolean },
  ) => api.post<InstructorFeedbackItem[]>(`/instructor/incidents/${incidentId}/feedback`, payload),
  downloadGradebook: (cohortId: string, cohortName: string) =>
    downloadFile(`/instructor/cohorts/${cohortId}/gradebook.csv`, `gradebook-${cohortName}.csv`),
};

export const identityPortalApi = {
  list: (sessionId: string) => api.get<Identity[]>(`/sessions/${sessionId}/identities`),
  getProfile: (sessionId: string, identityId: string) => api.get<Identity>(`/sessions/${sessionId}/identities/${identityId}`),
  getSignIns: (sessionId: string, identityId: string) => api.get<SignIn[]>(`/sessions/${sessionId}/identities/${identityId}/signins`),
};

export const mitreApi = {
  list: () => api.get<MitreTechniqueRef[]>('/mitre-techniques'),
};

export const devicePortalApi = {
  list: (sessionId: string) => api.get<Device[]>(`/sessions/${sessionId}/devices`),
  getProfile: (sessionId: string, deviceId: string) => api.get<Device>(`/sessions/${sessionId}/devices/${deviceId}`),
  getProcessTree: (sessionId: string, deviceId: string) =>
    api.get<ProcessEventNode[]>(`/sessions/${sessionId}/devices/${deviceId}/process-tree`),
  getFiles: (sessionId: string, deviceId: string) => api.get<FileEvent[]>(`/sessions/${sessionId}/devices/${deviceId}/files`),
  getNetwork: (sessionId: string, deviceId: string) =>
    api.get<NetworkEvent[]>(`/sessions/${sessionId}/devices/${deviceId}/network`),
  isolate: (sessionId: string, deviceId: string) => api.post<Device>(`/sessions/${sessionId}/devices/${deviceId}/isolate`, {}),
};

export const emailPortalApi = {
  list: (sessionId: string) => api.get<EmailMessage[]>(`/sessions/${sessionId}/emails`),
  get: (sessionId: string, emailId: string) => api.get<EmailMessage>(`/sessions/${sessionId}/emails/${emailId}`),
};

export const threatIntelApi = {
  lookup: (sessionId: string, type: string, value: string) =>
    api.get<{ value: string; type: string; reputation: string; actorAttribution: string | null; context: string | null }>(
      `/sessions/${sessionId}/threat-intel?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`,
    ),
};

export const hintsApi = {
  list: (sessionId: string) => api.get<HintItem[]>(`/sessions/${sessionId}/hints`),
  unlock: (sessionId: string, index: number) => api.post<HintItem[]>(`/sessions/${sessionId}/hints/${index}/unlock`),
};

export const leaderboardApi = {
  get: (period: 'weekly' | 'monthly' | 'all_time', scope: 'global' | 'cohort' = 'global', cohortId?: string) =>
    api.get<LeaderboardResult>(
      `/leaderboard?period=${period}&scope=${scope}${cohortId ? `&cohortId=${cohortId}` : ''}`,
    ),
};
