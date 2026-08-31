import { useQuery } from "@tanstack/react-query";
import { careerProgressionService } from "@/services/career-progression";
import { queryKeys } from "./query-keys";

export function useCareerProgression() {
  return useQuery({
    queryKey: queryKeys.careerProgression,
    queryFn: () => careerProgressionService.getMine(),
  });
}
