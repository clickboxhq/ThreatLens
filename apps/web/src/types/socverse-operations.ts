// Types matching SOCVerse's real API responses for the "operations" surface — the student's
// own session history, and the per-session alert/identity/device/email portals. Verified
// against apps/api's controllers/DTOs (sessions, alerts, identity-portal, device-portal,
// email-portal), same as socverse-investigation.ts covers the case-workspace domain.
//
// Everything here except SessionListItemDto is scoped to one investigation session at a time —
// SOCVerse generates each scenario's identities/devices/emails/alerts fresh per session, so
// there's no cross-session "org" for these to live in the way ThreatLens's original mock UI
// assumed. See use-active-session.ts for how pages pick which session they're showing.

import type { SessionStatus } from "./socverse-investigation";

export interface SessionListItemDto {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  status: SessionStatus;
  overallPercent: number | null;
  verdictCorrect: boolean | null;
  startedAt: string;
  submittedAt: string | null;
}

/** GET /sessions/skill-radar — per-MITRE-tactic proficiency across every scored session
 * (apps/api's computeSkillRadar). A tactic never touched by a required technique in any
 * scored session is omitted entirely, not zeroed out. */
export interface SkillRadarEntryDto {
  tactic: string;
  tacticName: string;
  requiredCount: number;
  hitCount: number;
  percent: number;
}

/** GET /sessions/technique-mastery — the same required-vs-tagged rollup as SkillRadarEntryDto,
 * per individual MITRE technique instead of per tactic. Backs the MITRE ATT&CK Explorer. */
export interface TechniqueMasteryEntryDto {
  techniqueId: string;
  name: string;
  tactic: string;
  tacticName: string;
  requiredCount: number;
  hitCount: number;
  percent: number;
}

export type AlertSeverity = "informational" | "low" | "medium" | "high" | "critical";
export type AlertStatus = "new" | "in_progress" | "resolved" | "dismissed";
export type AlertEntityType = "identity" | "device" | "mailbox";

export interface AlertDto {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  dismissalReason: string | null;
  primaryEntityType: AlertEntityType;
  primaryEntityId: string;
  /** Resolved server-side so the queue reads at a glance — the identity's name or the
   * device's hostname, or null if the entity's own record couldn't be found. */
  entityDisplay: string | null;
  mitreTechnique: { id: string; techniqueId: string; name: string } | null;
  relatedAlertId: string | null;
  dedupCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type IdentityRiskLevel = "none" | "low" | "medium" | "high";
export type MfaStatus = "enforced" | "registered_not_enforced" | "not_registered";
export type AccountStatus = "active" | "disabled" | "locked";

export interface IdentityDto {
  id: string;
  displayName: string;
  userPrincipalName: string;
  department: string;
  jobTitle: string;
  managerIdentityId: string | null;
  riskLevel: IdentityRiskLevel;
  mfaStatus: MfaStatus;
  accountStatus: AccountStatus;
  isPrivileged: boolean;
  homeCountry: string;
}

export interface IdentityProfileDto extends IdentityDto {
  devices: { id: string; hostname: string; osPlatform: string; riskLevel: string }[];
}

export type SignInResult = "success" | "failure" | "mfa_denied" | "blocked_by_ca";

export interface SignInEventDto {
  id: string;
  occurredAt: string;
  identityId: string;
  deviceId: string | null;
  sourceIp: string;
  sourceCountry: string;
  sourceCity: string;
  application: string;
  result: SignInResult;
  failureReason: string | null;
  isLegacyAuth: boolean;
  clientApp: string;
}

export type DeviceRiskLevel = "none" | "low" | "medium" | "high";
export type IsolationStatus = "not_isolated" | "isolated";

export interface DeviceDto {
  id: string;
  hostname: string;
  osPlatform: string;
  osVersion: string;
  primaryIdentityId: string | null;
  riskLevel: DeviceRiskLevel;
  isolationStatus: IsolationStatus;
  lastSeenAt: string;
}

export type EmailDirection = "inbound" | "outbound" | "internal";
export type SpfResult = "pass" | "fail" | "softfail" | "none";
export type DkimResult = "pass" | "fail" | "none";
export type DmarcResult = "pass" | "fail" | "none";

export interface EmailAttachmentDto {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  hashSha256: string;
  sandboxVerdict: string;
}

export interface EmailUrlDto {
  id: string;
  url: string;
  displayText: string;
  reputation: string;
  isRewrittenBySafeLinks: boolean;
}

export interface EmailMessageDto {
  /** When the sending domain was registered. Null where no record is available — an honest
   * unknown, which is itself a legitimate answer a real resolver also gives. */
  senderDomainRegisteredAt: string | null;
  id: string;
  occurredAt: string;
  messageId: string;
  direction: EmailDirection;
  senderAddress: string;
  senderDisplayName: string;
  recipientAddresses: string[];
  subject: string;
  bodyHtml: string;
  headersRaw: unknown;
  spfResult: SpfResult;
  dkimResult: DkimResult;
  dmarcResult: DmarcResult;
  attachments: EmailAttachmentDto[];
  urls: EmailUrlDto[];
}

/** GET /sessions/:id/emails/:id/link-activity — the "did anyone actually click it?" pivot.
 * Correlates each of an email's URLs against the session's own HTTP telemetry, so a click is
 * evidence the Student could also have found by hand, not a ground-truth flag. */
export interface EmailLinkClickDto {
  /** The underlying http_requests event id, so the click can be pinned as evidence. */
  id: string;
  occurredAt: string;
  statusCode: number;
  sourceIp: string;
  userAgent: string;
  identityId: string | null;
  identityDisplayName: string | null;
  identityUserPrincipalName: string | null;
  deviceId: string | null;
  deviceHostname: string | null;
}

export interface EmailLinkActivityDto {
  urlId: string;
  url: string;
  reputation: string;
  clickCount: number;
  clicks: EmailLinkClickDto[];
}

// Endpoint/cloud telemetry, mirroring apps/api's toStudent*Dto mappers. Ground-truth fields
// (isGroundTruthEvidence, mitreTechniqueId, correlationId, raw) are stripped server-side and
// deliberately absent here too.
export interface ProcessEventDto {
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
}

/** GET /devices/:id/process-tree returns roots with children nested by parentProcessGuid. */
export interface ProcessTreeNodeDto extends ProcessEventDto {
  children: ProcessTreeNodeDto[];
}

export interface FileEventDto {
  id: string;
  occurredAt: string;
  deviceId: string;
  action: string;
  filePath: string;
  hashSha256: string | null;
  processGuid: string | null;
}

export interface NetworkEventDto {
  id: string;
  occurredAt: string;
  deviceId: string;
  direction: string;
  protocol: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  bytesSent: number;
  bytesReceived: number;
  processGuid: string | null;
}

export interface HttpRequestDto {
  id: string;
  occurredAt: string;
  deviceId: string | null;
  method: string;
  url: string;
  userAgent: string;
  statusCode: number;
  sourceIp: string;
}

export interface CloudEventDto {
  id: string;
  occurredAt: string;
  identityId: string;
  provider: string;
  actionName: string;
  resourceId: string | null;
  sourceIp: string;
}

/** GET /sessions/:id/alerts/:id/evidence — the telemetry a detection actually fired on.
 * The rule's own working, so a learner can see why an alert exists rather than guess. */
export interface AlertEvidenceItemDto {
  eventTable: string;
  eventId: string;
  occurredAt: string;
  summary: string;
  detail: Record<string, unknown>;
}

export interface AlertEvidenceDto {
  alertId: string;
  evidence: AlertEvidenceItemDto[];
}

/** GET /sessions/:id/identities/:id/audit-events — the directory control-plane trail for an
 * account: what was *done to* it, as opposed to SignInEventDto's when it authenticated.
 * Account takeover shows up here first (attacker registers their own MFA method, adds a
 * forwarding rule) without ever producing an unusual sign-in. */
export type DirectoryAuditCategory =
  | "credential"
  | "mfa"
  | "group_membership"
  | "role_assignment"
  | "account_lifecycle"
  | "mailbox_rule";

export interface DirectoryAuditEventDto {
  id: string;
  occurredAt: string;
  targetIdentityId: string;
  actorIdentityId: string | null;
  actorDisplayName: string;
  category: DirectoryAuditCategory;
  action: string;
  result: "success" | "failure";
  detail: unknown;
  sourceIp: string;
}

/** GET /sessions/:id/{identities|devices|emails}/:id/insights — the questions a competent
 * analyst asks of this entity, answered from telemetry the Student can already reach.
 *
 * Deliberately inverted from how production consoles use this: Sentinel pre-answers expert
 * questions to save an analyst time, but our learner does not yet know which questions matter,
 * so the UI shows the question and folds the answer away until they ask for it. `notable` means
 * the observation is unusual, never that it is malicious — a business trip and a stolen
 * credential look identical here on purpose. */
export interface EntityInsightDto {
  id: string;
  question: string;
  answer: string;
  detail?: string;
  tone: "neutral" | "notable";
}

/** The learner's own record of how they worked a case (GET /sessions/:id/activity). */
export interface ActivityEntryDto {
  id: string;
  actionType: string;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  occurredAt: string;
  summary: string;
}

export interface ActivityLogDto {
  entries: ActivityEntryDto[];
  summary: {
    totalActions: number;
    entitiesOpened: number;
    evidencePinned: number;
    searchesRun: number;
    hintsUnlocked: number;
    responseActionsTaken: number;
  };
}
