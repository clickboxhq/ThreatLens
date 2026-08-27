import { useQuery } from "@tanstack/react-query";
import { studentAnalyticsService } from "@/services/student-analytics";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useStudentAnalytics() {
  const studentsQuery = useQuery({
    queryKey: [...queryKeys.studentAnalytics, "students"],
    queryFn: () => studentAnalyticsService.listStudents(),
  });
  const statsQuery = useQuery({
    queryKey: [...queryKeys.studentAnalytics, "stats"],
    queryFn: () => studentAnalyticsService.getStats(),
  });
  const failureModesQuery = useQuery({
    queryKey: [...queryKeys.studentAnalytics, "failure-modes"],
    queryFn: () => studentAnalyticsService.listFailureModes(),
  });
  return {
    students: studentsQuery.data ?? [],
    stats: statsQuery.data,
    failureModes: failureModesQuery.data ?? [],
    state: deriveViewState(studentsQuery),
  };
}
