// Types matching SOCVerse's real instructor-mode API — verified against
// apps/api/src/modules/{cohorts,instructor}. Two roles touch this domain: any student can join
// a cohort by code (cohorts.controller.ts, /cohorts/*), while cohort creation/management/grading
// is instructor-only (instructor.controller.ts, /instructor/*, RolesGuard-gated).

export interface MyCohortDto {
  id: string;
  name: string;
  enrolledAt: string;
}

export interface MyAssignmentDto {
  id: string;
  cohortName: string;
  scenarioId: string;
  scenarioTitle: string;
  dueAt: string | null;
  attemptLimit: number | null;
  attemptsUsed: number;
}

export interface OwnedCohortDto {
  id: string;
  name: string;
  joinCode: string;
  startsAt: string | null;
  endsAt: string | null;
  enrollmentCount: number;
  assignmentCount: number;
  createdAt: string;
}

export type EnrollmentStatus = "active" | "removed";

export interface RosterEntryDto {
  userId: string;
  displayName: string;
  email: string;
  status: EnrollmentStatus;
  /** Null means enrolled in the cohort but not placed in any group. */
  groupId: string | null;
  groupName: string | null;
  enrolledAt: string;
}

export interface AssignmentDto {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  /** Null means the whole cohort; set targets one group. */
  groupId: string | null;
  groupName: string | null;
  dueAt: string | null;
  attemptLimit: number | null;
  createdAt: string;
}

export interface ReviewQueueItemDto {
  sessionId: string;
  studentDisplayName: string;
  studentEmail: string;
  scenarioTitle: string;
  status: "submitted" | "scored";
  submittedAt: string | null;
  overallPercent: number | null;
  verdictCorrect: boolean | null;
}

export interface InstructorFeedbackDto {
  id: string;
  instructorDisplayName: string;
  rubricOverrides: unknown;
  comment: string;
  reopenedSession: boolean;
  createdAt: string;
}

// ---------- Cohort staffing and groups ----------

export type CohortStaffRole = "lead" | "tutor" | "group_tutor";

export interface CohortStaffDto {
  userId: string;
  displayName: string;
  email: string;
  role: CohortStaffRole;
  addedAt: string;
  /** Populated for a group_tutor; empty for whole-cohort staff. */
  groups: { id: string; name: string }[];
}

export interface CohortGroupDto {
  id: string;
  name: string;
  studentCount: number;
  assignmentCount: number;
  tutors: { userId: string; displayName: string }[];
  createdAt: string;
}

export type CohortInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface CohortInviteDto {
  id: string;
  email: string;
  groupId: string | null;
  groupName: string | null;
  status: CohortInviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

/** What the join page can show before the visitor has signed in. */
export interface CohortInvitePreviewDto {
  cohortName: string;
  groupName: string | null;
  inviterName: string;
  email: string;
  status: CohortInviteStatus;
  /** Drives whether the page leads with "sign in" or "create an account". */
  hasAccount: boolean;
}
