import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { instructorService } from "@/services/instructor";

const keys = {
  cohorts: ["instructor", "cohorts"] as const,
  roster: (cohortId: string) => ["instructor", "cohorts", cohortId, "roster"] as const,
  assignments: (cohortId: string) => ["instructor", "cohorts", cohortId, "assignments"] as const,
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
