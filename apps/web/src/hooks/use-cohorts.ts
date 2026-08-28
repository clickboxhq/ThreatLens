import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cohortsService } from "@/services/cohorts";

const keys = {
  mine: ["cohorts", "mine"] as const,
  myAssignments: ["cohorts", "mine", "assignments"] as const,
};

export function useMyCohorts() {
  return useQuery({
    queryKey: keys.mine,
    queryFn: () => cohortsService.listMine(),
  });
}

export function useMyAssignments() {
  return useQuery({
    queryKey: keys.myAssignments,
    queryFn: () => cohortsService.listMyAssignments(),
  });
}

export function useJoinCohort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (joinCode: string) => cohortsService.join(joinCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.mine });
      queryClient.invalidateQueries({ queryKey: keys.myAssignments });
    },
  });
}
