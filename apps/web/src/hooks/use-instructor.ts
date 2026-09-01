import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instructorService } from "@/services/instructor";
import type {
  CohortGroupDto,
  CohortStaffDto,
  CohortStaffRole,
} from "@/types/threatlens-instructor";

const keys = {
  cohorts: ["instructor", "cohorts"] as const,
  roster: (cohortId: string) => ["instructor", "cohorts", cohortId, "roster"] as const,
  assignments: (cohortId: string) => ["instructor", "cohorts", cohortId, "assignments"] as const,
  staff: (cohortId: string) => ["instructor", "cohort", cohortId, "staff"] as const,
  groups: (cohortId: string) => ["instructor", "cohort", cohortId, "groups"] as const,
  reviewQueue: (cohortId: string) => ["instructor", "cohorts", cohortId, "review-queue"] as const,
};

export function useOwnedCohorts() {
  return useQuery({
    queryKey: keys.cohorts,
    queryFn: () => instructorService.listCohorts(),
  });
}

/** Every instructor page below the cohort list needs one cohort in scope — this picks the most
 * recently created by default, with an override for instructors running more than one. */
export function useSelectedCohort() {
  const cohortsQuery = useOwnedCohorts();
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const cohorts = useMemo(() => cohortsQuery.data ?? [], [cohortsQuery.data]);
  const selected = cohorts.find((c) => c.id === overrideId) ?? cohorts[0] ?? null;

  return {
    isLoading: cohortsQuery.isLoading,
    cohorts,
    selectedCohort: selected,
    selectedCohortId: selected?.id,
    setSelectedCohortId: setOverrideId,
  };
}

export function useCreateCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startsAt?: string; endsAt?: string }) =>
      instructorService.createCohort(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.cohorts }),
  });
}

export function useRoster(cohortId: string | undefined) {
  return useQuery({
    queryKey: cohortId ? keys.roster(cohortId) : ["roster", "none"],
    queryFn: () => instructorService.getRoster(cohortId!),
    enabled: Boolean(cohortId),
  });
}

export function useAssignments(cohortId: string | undefined) {
  return useQuery({
    queryKey: cohortId ? keys.assignments(cohortId) : ["assignments", "none"],
    queryFn: () => instructorService.listAssignments(cohortId!),
    enabled: Boolean(cohortId),
  });
}

export function useCreateAssignment(cohortId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { scenarioId: string; dueAt?: string; attemptLimit?: number }) =>
      instructorService.createAssignment(cohortId!, input),
    onSuccess: () => {
      if (cohortId) {
        queryClient.invalidateQueries({ queryKey: keys.assignments(cohortId) });
        queryClient.invalidateQueries({ queryKey: keys.cohorts });
      }
    },
  });
}

export function useReviewQueue(cohortId: string | undefined) {
  return useQuery({
    queryKey: cohortId ? keys.reviewQueue(cohortId) : ["review-queue", "none"],
    queryFn: () => instructorService.reviewQueue(cohortId!),
    enabled: Boolean(cohortId),
  });
}

export function useSubmitFeedback(cohortId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      incidentId: string;
      comment?: string;
      rubricOverrides?: Record<string, number>;
      reopenSession?: boolean;
    }) => {
      const { incidentId, ...body } = input;
      return instructorService.submitFeedback(incidentId, body);
    },
    onSuccess: () => {
      if (cohortId) queryClient.invalidateQueries({ queryKey: keys.reviewQueue(cohortId) });
    },
  });
}

// ---------- Cohort staffing and groups ----------
//
// Every mutation returns the whole refreshed list, so the cache is seeded from the response
// rather than refetched. Roster is invalidated alongside groups, since placing a student or
// deleting a group changes what the roster shows.

export function useCohortStaff(cohortId: string | undefined) {
  return useQuery({
    queryKey: cohortId ? keys.staff(cohortId) : ["staff", "none"],
    queryFn: () => instructorService.listStaff(cohortId!),
    enabled: Boolean(cohortId),
  });
}

export function useCohortGroups(cohortId: string | undefined) {
  return useQuery({
    queryKey: cohortId ? keys.groups(cohortId) : ["groups", "none"],
    queryFn: () => instructorService.listGroups(cohortId!),
    enabled: Boolean(cohortId),
  });
}

export function useCohortStaffMutations(cohortId: string | undefined) {
  const queryClient = useQueryClient();
  const seedStaff = (data: CohortStaffDto[]) => {
    if (cohortId) queryClient.setQueryData(keys.staff(cohortId), data);
  };

  const addStaff = useMutation({
    mutationFn: (input: { email: string; role: CohortStaffRole }) =>
      instructorService.addStaff(cohortId!, input),
    onSuccess: seedStaff,
  });

  const updateRole = useMutation({
    mutationFn: (input: { userId: string; role: CohortStaffRole }) =>
      instructorService.updateStaffRole(cohortId!, input.userId, input.role),
    onSuccess: (data) => {
      seedStaff(data);
      // A demotion can strip group tutorships, so the group list is no longer accurate.
      if (cohortId) queryClient.invalidateQueries({ queryKey: keys.groups(cohortId) });
    },
  });

  const removeStaff = useMutation({
    mutationFn: (userId: string) => instructorService.removeStaff(cohortId!, userId),
    onSuccess: (data) => {
      seedStaff(data);
      if (cohortId) queryClient.invalidateQueries({ queryKey: keys.groups(cohortId) });
    },
  });

  return { addStaff, updateRole, removeStaff };
}

export function useCohortGroupMutations(cohortId: string | undefined) {
  const queryClient = useQueryClient();
  const seedGroups = (data: CohortGroupDto[]) => {
    if (cohortId) {
      queryClient.setQueryData(keys.groups(cohortId), data);
      queryClient.invalidateQueries({ queryKey: keys.roster(cohortId) });
    }
  };

  const createGroup = useMutation({
    mutationFn: (name: string) => instructorService.createGroup(cohortId!, name),
    onSuccess: seedGroups,
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => instructorService.deleteGroup(cohortId!, groupId),
    onSuccess: seedGroups,
  });

  const assignTutor = useMutation({
    mutationFn: (input: { groupId: string; userId: string }) =>
      instructorService.assignGroupTutor(cohortId!, input.groupId, input.userId),
    onSuccess: (data) => {
      seedGroups(data);
      // The staff list shows which groups each group_tutor runs.
      if (cohortId) queryClient.invalidateQueries({ queryKey: keys.staff(cohortId) });
    },
  });

  const removeTutor = useMutation({
    mutationFn: (input: { groupId: string; userId: string }) =>
      instructorService.removeGroupTutor(cohortId!, input.groupId, input.userId),
    onSuccess: (data) => {
      seedGroups(data);
      if (cohortId) queryClient.invalidateQueries({ queryKey: keys.staff(cohortId) });
    },
  });

  const placeStudent = useMutation({
    mutationFn: (input: { studentUserId: string; groupId: string | null }) =>
      instructorService.placeStudentInGroup(cohortId!, input.studentUserId, input.groupId),
    onSuccess: () => {
      if (cohortId) {
        queryClient.invalidateQueries({ queryKey: keys.roster(cohortId) });
        queryClient.invalidateQueries({ queryKey: keys.groups(cohortId) });
      }
    },
  });

  return { createGroup, deleteGroup, assignTutor, removeTutor, placeStudent };
}
