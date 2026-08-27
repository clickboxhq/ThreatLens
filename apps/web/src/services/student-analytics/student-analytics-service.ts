import type {
  StudentAnalyticsRow,
  StudentAnalyticsStats,
  FailureMode,
} from "@/types/student-analytics";

export interface StudentAnalyticsService {
  listStudents(): Promise<StudentAnalyticsRow[]>;
  getStats(): Promise<StudentAnalyticsStats>;
  listFailureModes(): Promise<FailureMode[]>;
}
