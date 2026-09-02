import { apiClient } from "@/lib/api-client";
import type { InstructorService } from "./instructor-service";
import type {
  AssignmentDto,
  InstructorFeedbackDto,
  OwnedCohortDto,
  ReviewQueueItemDto,
  RosterEntryDto,
} from "@/types/threatlens-instructor";

export const apiInstructorService: InstructorService = {
  listCohorts: () => apiClient.get<OwnedCohortDto[]>("/instructor/cohorts"),

  createCohort: (input) => apiClient.post<OwnedCohortDto>("/instructor/cohorts", input),

  getRoster: (cohortId) =>
    apiClient.get<RosterEntryDto[]>(`/instructor/cohorts/${cohortId}/roster`),

  listAssignments: (cohortId) =>
    apiClient.get<AssignmentDto[]>(`/instructor/cohorts/${cohortId}/assignments`),

  createAssignment: (cohortId, input) =>
    apiClient.post<AssignmentDto>(`/instructor/cohorts/${cohortId}/assignments`, input),

  reviewQueue: (cohortId) =>
    apiClient.get<ReviewQueueItemDto[]>(`/instructor/cohorts/${cohortId}/review-queue`),

  submitFeedback: (incidentId, input) =>
    apiClient.post<InstructorFeedbackDto[]>(`/instructor/incidents/${incidentId}/feedback`, input),
};
