// Hand-written response types mirroring the backend's Student-facing DTOs (§18.3). Deferred
// to OpenAPI codegen once the API surface grows past the walking-skeleton scope (§17.6).

export interface AuthUser {
  id: string;
  displayName: string;
  role: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ScenarioSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
}

export interface SessionSummary {
  id: string;
  scenarioId: string;
  status: 'active' | 'submitted' | 'scored' | 'abandoned';
  ready: boolean;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
}

export interface MitreTechniqueRef {
  id: string;
  techniqueId: string;
  name: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'resolved' | 'dismissed';
  dismissalReason: string | null;
  primaryEntityType: 'identity' | 'device' | 'mailbox';
  primaryEntityId: string;
  mitreTechnique: MitreTechniqueRef | null;
  relatedAlertId: string | null;
  dedupCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface Identity {
  id: string;
  displayName: string;
  userPrincipalName: string;
  department: string;
  jobTitle: string;
  managerIdentityId: string | null;
  riskLevel: string;
  mfaStatus: string;
  accountStatus: string;
  isPrivileged: boolean;
  homeCountry: string;
}

export interface SignIn {
  id: string;
  occurredAt: string;
  identityId: string;
  deviceId: string | null;
  sourceIp: string;
  sourceCountry: string;
  sourceCity: string;
  application: string;
  result: string;
  failureReason: string | null;
  isLegacyAuth: boolean;
  clientApp: string;
  distanceFromPreviousKm?: number | null;
  impliedTravelSpeedKmh?: number | null;
}

export interface Device {
  id: string;
  hostname: string;
  osPlatform: string;
  osVersion: string;
  primaryIdentityId: string | null;
  riskLevel: string;
  isolationStatus: 'not_isolated' | 'isolated';
  lastSeenAt: string;
}

export interface ProcessEventNode {
  id: string;
  occurredAt: string;
  deviceId: string;
  processGuid: string;
  parentProcessGuid: string | null;
  imagePath: string;
  commandLine: string;
  hashSha256: string;
  parentImagePath: string | null;
  integrityLevel: string;
  identityId: string | null;
  children: ProcessEventNode[];
}

export interface FileEvent {
  id: string;
  occurredAt: string;
  deviceId: string;
  action: 'created' | 'modified' | 'deleted' | 'renamed' | 'encrypted';
  filePath: string;
  hashSha256: string | null;
  processGuid: string | null;
}

export interface NetworkEvent {
  id: string;
  occurredAt: string;
  deviceId: string;
  direction: 'inbound' | 'outbound';
  protocol: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  bytesSent: number;
  bytesReceived: number;
  processGuid: string | null;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  hashSha256: string;
  sandboxVerdict: string;
}

export interface EmailUrl {
  id: string;
  url: string;
  displayText: string;
  reputation: string;
  isRewrittenBySafeLinks: boolean;
}

export interface EmailMessage {
  id: string;
  occurredAt: string;
  messageId: string;
  direction: string;
  senderAddress: string;
  senderDisplayName: string;
  recipientAddresses: string[];
  subject: string;
  bodyHtml: string;
  headersRaw: unknown;
  spfResult: string;
  dkimResult: string;
  dmarcResult: string;
  attachments: EmailAttachment[];
  urls: EmailUrl[];
}

// Returned by GET /incidents (§16.6 list) — deliberately lighter than the full detail shape.
export interface IncidentSummary {
  id: string;
  title: string;
  status: 'open' | 'investigating' | 'contained' | 'closed' | 'reopened';
  verdict: 'true_positive' | 'false_positive' | 'benign_positive' | null;
  linkedAlertCount: number;
  createdAt: string;
  closedAt: string | null;
}

// Returned by POST/PATCH/close and GET /incidents/:id — the full detail shape every
// mutation endpoint's response already used; the list endpoint never returned this.
export interface Incident {
  id: string;
  title: string;
  status: 'open' | 'investigating' | 'contained' | 'closed' | 'reopened';
  verdict: 'true_positive' | 'false_positive' | 'benign_positive' | null;
  summary?: string | null;
  linkedAlertIds: string[];
  techniques: MitreTechniqueRef[];
  createdAt: string;
  closedAt: string | null;
}

export interface EvidenceItem {
  id: string;
  eventTable: string;
  eventId: string;
  justification: string;
  mitreTechniqueId: string | null;
  pinnedAt: string;
}

export interface AnalystNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface RubricBreakdown {
  techniqueAccuracyPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  falsePositiveHandlingPercent: number;
  falsePositiveCount: number;
  responsePercent: number;
  verdictCorrect: boolean;
  overallPercent: number;
}

export interface ScoreResult {
  overallPercent: number;
  techniqueAccuracyPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  falsePositiveCount: number;
  hintPenaltyPercent: number;
  timeToResolutionSeconds: number;
  verdictCorrect: boolean;
  rubricBreakdown: RubricBreakdown;
  scoredAt: string;
}
