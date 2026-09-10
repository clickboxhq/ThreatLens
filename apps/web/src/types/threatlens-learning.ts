// Types matching SOCVerse's real learning/leaderboard/certificates/audit-log API — verified
// against apps/api/src/modules/{learning,leaderboard,admin}.

export interface CoursePathSummaryDto {
  id: string;
  slug: string;
  title: string;
  scenarioCount: number;
}

export interface CourseDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  careerTrack: string;
  paths: CoursePathSummaryDto[];
}

export interface LearningPathScenarioDto {
  scenarioId: string;
  sortOrder: number;
  title: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  bestPercent: number | null;
  completed: boolean;
}

export interface LearningPathDto {
  id: string;
  slug: string;
  title: string;
  courseTitle: string;
  passThresholdPercent: number;
  scenarios: LearningPathScenarioDto[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  certificateId: string | null;
}

export interface MyCertificateDto {
  publicId: string;
  careerTrackName: string;
  issuedAt: string;
  revoked: boolean;
}

/**
 * The full certificate payload used to render the document — on the owner's view
 * page and on the public /verify page (same shape, deliberately minimal-PII: no
 * email, no per-scenario scores).
 */
export interface CertificateDto {
  certificateId: string;
  recipientName: string;
  careerTrackName: string;
  completedAt: string;
  issuedAt: string;
  status: "active" | "revoked";
  verifyUrl: string;
  qrDataUrl: string;
}

export interface CareerTrackProgressDto {
  courseId: string;
  careerTrackName: string;
  requiredCount: number;
  completedCount: number;
  eligible: boolean;
  certificate: { publicId: string; revoked: boolean } | null;
}

export type LeaderboardPeriod = "weekly" | "monthly" | "all_time";
export type LeaderboardScope = "global" | "cohort";

export interface LeaderboardEntryDto {
  /** Null for everyone but the viewer on the global board — see LeaderboardDto.anonymised. */
  userId: string | null;
  displayName: string | null;
  points: number;
  completions: number;
  averagePercent: number;
  rank: number;
}

export interface LeaderboardDto {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  /** True on the global board, which spans every organisation: other learners' names and ids
   * are withheld server-side, leaving rank and score. False inside a cohort, whose members
   * already know each other. */
  anonymised: boolean;
  entries: LeaderboardEntryDto[];
  myEntry: LeaderboardEntryDto | null;
}

/** platform_admin-only (RolesGuard) — no self-service signup path issues this role today. */
export interface AuditLogEntryDto {
  id: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorIp: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: unknown;
  correlationId: string | null;
  occurredAt: string;
}
