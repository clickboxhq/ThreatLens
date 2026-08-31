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
  enrolledAt: string;
}

export interface AssignmentDto {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
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
