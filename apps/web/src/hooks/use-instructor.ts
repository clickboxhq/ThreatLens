import { useQuery } from "@tanstack/react-query";
import { instructorService } from "@/services/instructor";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useInstructor() {
  const query = useQuery({
    queryKey: queryKeys.instructor,
    queryFn: () => instructorService.listCohorts(),
  });
  return { ...query, cohorts: query.data ?? [], state: deriveViewState(query) };
}
