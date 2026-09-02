import { apiClient } from "@/lib/api-client";
import type { InstructorService } from "./instructor-service";
import type {
  AssignmentDto,
  CohortGroupDto,
  CohortStaffDto,
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

  listStaff: (cohortId) => apiClient.get<CohortStaffDto[]>(`/instructor/cohorts/${cohortId}/staff`),

  addStaff: (cohortId, input) =>
    apiClient.post<CohortStaffDto[]>(`/instructor/cohorts/${cohortId}/staff`, input),

  updateStaffRole: (cohortId, userId, role) =>
    apiClient.patch<CohortStaffDto[]>(`/instructor/cohorts/${cohortId}/staff/${userId}`, { role }),

  removeStaff: (cohortId, userId) =>
    apiClient.delete<CohortStaffDto[]>(`/instructor/cohorts/${cohortId}/staff/${userId}`),

  listGroups: (cohortId) =>
    apiClient.get<CohortGroupDto[]>(`/instructor/cohorts/${cohortId}/groups`),

  createGroup: (cohortId, name) =>
    apiClient.post<CohortGroupDto[]>(`/instructor/cohorts/${cohortId}/groups`, {
      name,
    }),

  deleteGroup: (cohortId, groupId) =>
    apiClient.delete<CohortGroupDto[]>(`/instructor/cohorts/${cohortId}/groups/${groupId}`),

  assignGroupTutor: (cohortId, groupId, userId) =>
    apiClient.post<CohortGroupDto[]>(`/instructor/cohorts/${cohortId}/groups/${groupId}/tutors`, {
      userId,
    }),

  removeGroupTutor: (cohortId, groupId, userId) =>
    apiClient.delete<CohortGroupDto[]>(
      `/instructor/cohorts/${cohortId}/groups/${groupId}/tutors/${userId}`,
    ),

  placeStudentInGroup: (cohortId, studentUserId, groupId) =>
    apiClient.patch<{ userId: string; groupId: string | null }>(
      `/instructor/cohorts/${cohortId}/students/${studentUserId}/group`,
      { groupId },
    ),
};
