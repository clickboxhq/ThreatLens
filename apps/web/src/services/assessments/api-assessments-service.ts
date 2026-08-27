import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AssessmentsService } from "./assessments-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`AssessmentsService.${method}`);
};

export const apiAssessmentsService: AssessmentsService = {
  listAssessments: () => notConnected("listAssessments"),
  getStats: () => notConnected("getStats"),
  listGradingBreakdown: () => notConnected("listGradingBreakdown"),
};
