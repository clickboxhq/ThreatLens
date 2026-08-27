import type { StudentAnalyticsService } from "./student-analytics-service";
import { mockStudentAnalyticsService } from "./mock-student-analytics-service";

export const studentAnalyticsService: StudentAnalyticsService = mockStudentAnalyticsService;
export type { StudentAnalyticsService } from "./student-analytics-service";
