import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { ProfileService } from "./profile-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`ProfileService.${method}`);
};

export const apiProfileService: ProfileService = {
  getSummary: () => notConnected("getSummary"),
  listSkillMastery: () => notConnected("listSkillMastery"),
};
