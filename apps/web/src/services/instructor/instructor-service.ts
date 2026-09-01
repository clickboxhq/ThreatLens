import type {
  AssignmentDto,
  CohortGroupDto,
  CohortStaffDto,
  CohortStaffRole,
  InstructorFeedbackDto,
  OwnedCohortDto,
  ReviewQueueItemDto,
  RosterEntryDto,
} from "@/types/threatlens-instructor";

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

  // Staffing. Every mutation returns the whole refreshed list, so the client never has to
  // reconcile a partial update against what it already had.
  listStaff(cohortId: string): Promise<CohortStaffDto[]>;
  addStaff(
    cohortId: string,
    input: { email: string; role: CohortStaffRole },
  ): Promise<CohortStaffDto[]>;
  updateStaffRole(
    cohortId: string,
    userId: string,
    role: CohortStaffRole,
  ): Promise<CohortStaffDto[]>;
  removeStaff(cohortId: string, userId: string): Promise<CohortStaffDto[]>;

  // Groups.
  listGroups(cohortId: string): Promise<CohortGroupDto[]>;
  createGroup(cohortId: string, name: string): Promise<CohortGroupDto[]>;
  deleteGroup(cohortId: string, groupId: string): Promise<CohortGroupDto[]>;
  assignGroupTutor(cohortId: string, groupId: string, userId: string): Promise<CohortGroupDto[]>;
  removeGroupTutor(cohortId: string, groupId: string, userId: string): Promise<CohortGroupDto[]>;
  placeStudentInGroup(
    cohortId: string,
    studentUserId: string,
    groupId: string | null,
  ): Promise<{ userId: string; groupId: string | null }>;
}
