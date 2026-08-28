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
  id: string;
  learningPathId: string;
  learningPathTitle: string;
  issuedAt: string;
  revoked: boolean;
}

/** Deliberately minimal-PII (apps/api's own comment on why) — no email, no per-scenario
 * scores, just enough to confirm a credential is real. */
export interface PublicCertificateDto {
  id: string;
  learnerDisplayName: string;
  learningPathTitle: string;
  issuedAt: string;
  valid: boolean;
}

export type LeaderboardPeriod = "weekly" | "monthly" | "all_time";
export type LeaderboardScope = "global" | "cohort";

export interface LeaderboardEntryDto {
  userId: string;
  displayName: string;
  points: number;
  completions: number;
  averagePercent: number;
  rank: number;
}

export interface LeaderboardDto {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
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
