import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { CohortsService } from "./cohorts-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`CohortsService.${method}`);
};

export const apiCohortsService: CohortsService = {
  listCohorts: () => notConnected("listCohorts"),
  getStats: () => notConnected("getStats"),
  listTrackCompletion: () => notConnected("listTrackCompletion"),
};
