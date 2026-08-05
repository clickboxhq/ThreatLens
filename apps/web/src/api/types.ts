// Hand-written response types mirroring the backend's Student-facing DTOs (§18.3). Deferred
// to OpenAPI codegen once the API surface grows past the walking-skeleton scope (§17.6).

export interface AuthUser {
  id: string;
  displayName: string;
  role: 'student' | 'instructor' | 'org_admin' | 'platform_admin';
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type LoginResponse = (TokenResponse & { user: AuthUser }) | { mfaRequired: true; mfaChallengeId: string };

export interface MfaStatus {
  enabled: boolean;
  mandatory: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
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

export interface SessionHistoryItem {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  status: 'active' | 'submitted' | 'scored' | 'abandoned';
  overallPercent: number | null;
  verdictCorrect: boolean | null;
  startedAt: string;
  submittedAt: string | null;
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

export interface CloudEvent {
  id: string;
  occurredAt: string;
  identityId: string;
  provider: string;
  actionName: string;
  resourceId: string | null;
  sourceIp: string;
}

export interface HttpRequest {
  id: string;
  occurredAt: string;
  deviceId: string | null;
  method: string;
  url: string;
  userAgent: string;
  statusCode: number;
  sourceIp: string;
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

export interface MissedEvidenceItem {
  eventTable: string;
  summary: string;
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
  missedTechniques: MitreTechniqueRef[];
  missedEvidence: MissedEvidenceItem[];
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

// ---------- Instructor Mode (§2.15) ----------

export interface Cohort {
  id: string;
  name: string;
  joinCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
  enrollmentCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface CohortMembership {
  id: string;
  name: string;
  enrolledAt: string;
}

export interface RosterEntry {
  userId: string;
  displayName: string;
  email: string;
  status: 'active' | 'dropped';
  enrolledAt: string;
}

export interface CohortAssignment {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  dueAt: string | null;
  attemptLimit: number | null;
  createdAt: string;
}

export interface MyAssignment {
  id: string;
  cohortName: string;
  scenarioId: string;
  scenarioTitle: string;
  dueAt: string | null;
  attemptLimit: number | null;
  attemptsUsed: number;
}

export interface ReviewQueueItem {
  sessionId: string;
  studentDisplayName: string;
  studentEmail: string;
  scenarioTitle: string;
  status: 'submitted' | 'scored';
  submittedAt: string | null;
  overallPercent: number | null;
  verdictCorrect: boolean | null;
}

export interface InstructorFeedbackItem {
  id: string;
  instructorDisplayName: string;
  rubricOverrides: Record<string, number> | null;
  comment: string | null;
  reopenedSession: boolean;
  createdAt: string;
}

// ---------- Learning Platform (§13) ----------

export interface LearningPathSummary {
  id: string;
  slug: string;
  title: string;
  scenarioCount: number;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  careerTrack: string;
  paths: LearningPathSummary[];
}

export interface LearningPathScenarioProgress {
  scenarioId: string;
  sortOrder: number;
  title: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  bestPercent: number | null;
  completed: boolean;
}

export interface LearningPathDetail {
  id: string;
  slug: string;
  title: string;
  courseTitle: string;
  passThresholdPercent: number;
  scenarios: LearningPathScenarioProgress[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  certificateId: string | null;
}

export interface MyCertificate {
  id: string;
  learningPathId: string;
  learningPathTitle: string;
  issuedAt: string;
  revoked: boolean;
}

export interface CertificateVerification {
  id: string;
  learnerDisplayName: string;
  learningPathTitle: string;
  issuedAt: string;
  valid: boolean;
}

// ---------- Leaderboard (§13.5) ----------

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  completions: number;
  averagePercent: number;
}

export interface LeaderboardResult {
  period: 'weekly' | 'monthly' | 'all_time';
  scope: 'global' | 'cohort';
  entries: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
}

// ---------- Hints (§12.5) ----------

export interface HintItem {
  index: number;
  unlockCostPercent: number;
  unlocked: boolean;
  text: string | null;
}
