import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { StudentAnalyticsService } from "./student-analytics-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`StudentAnalyticsService.${method}`);
};

export const apiStudentAnalyticsService: StudentAnalyticsService = {
  listStudents: () => notConnected("listStudents"),
  getStats: () => notConnected("getStats"),
  listFailureModes: () => notConnected("listFailureModes"),
};
