import type {
  AssignmentDto,
  InstructorFeedbackDto,
  OwnedCohortDto,
  ReviewQueueItemDto,
  RosterEntryDto,
} from "@/types/socverse-instructor";

/** Instructor-only management surface (RolesGuard-gated on the backend) — creating and running
 * cohorts, assigning scenarios, and grading what students submit. */
export interface InstructorService {
  listCohorts(): Promise<OwnedCohortDto[]>;
  createCohort(input: {
    name: string;
    startsAt?: string;
    endsAt?: string;
  }): Promise<OwnedCohortDto>;
  getRoster(cohortId: string): Promise<RosterEntryDto[]>;
  listAssignments(cohortId: string): Promise<AssignmentDto[]>;
  createAssignment(
    cohortId: string,
    input: { scenarioId: string; dueAt?: string; attemptLimit?: number },
  ): Promise<AssignmentDto>;
  reviewQueue(cohortId: string): Promise<ReviewQueueItemDto[]>;
  submitFeedback(
    incidentId: string,
    input: { comment?: string; rubricOverrides?: Record<string, number>; reopenSession?: boolean },
  ): Promise<InstructorFeedbackDto[]>;
}
