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
