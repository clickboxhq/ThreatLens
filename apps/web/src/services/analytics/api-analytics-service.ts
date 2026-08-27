import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AnalyticsService } from "./analytics-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`AnalyticsService.${method}`);
};

export const apiAnalyticsService: AnalyticsService = {
  listSignedOverTime: () => notConnected("listSignedOverTime"),
  listMeanTime: () => notConnected("listMeanTime"),
  listMitreCoverage: () => notConnected("listMitreCoverage"),
};
