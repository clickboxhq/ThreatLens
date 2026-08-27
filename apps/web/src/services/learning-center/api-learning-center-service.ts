import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { LearningCenterService } from "./learning-center-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`LearningCenterService.${method}`);
};

export const apiLearningCenterService: LearningCenterService = {
  listTracks: () => notConnected("listTracks"),
  listAchievements: () => notConnected("listAchievements"),
  listCertificates: () => notConnected("listCertificates"),
};
