import { api } from './client';
import type {
  Alert,
  AnalystNote,
  AuthUser,
  Device,
  EmailMessage,
  EvidenceItem,
  FileEvent,
  Identity,
  Incident,
  IncidentSummary,
  MitreTechniqueRef,
  NetworkEvent,
  ProcessEventNode,
  ScenarioSummary,
  ScoreResult,
  SessionSummary,
  SignIn,
  TokenResponse,
} from './types';

export const authApi = {
  signup: (email: string, password: string, displayName: string) =>
    api.post<{ userId: string; emailVerificationRequired: boolean }>('/auth/signup', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post<TokenResponse & { user: AuthUser }>('/auth/login', { email, password }),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }),
};

export const scenarioApi = {
  list: () => api.get<ScenarioSummary[]>('/scenarios'),
};

export const sessionApi = {
  create: (scenarioId: string) => api.post<SessionSummary>('/sessions', { scenarioId }),
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
