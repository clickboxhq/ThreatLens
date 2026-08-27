import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AchievementsService } from "./achievements-service";

export const apiAchievementsService: AchievementsService = {
  listAchievements: () => {
    throw new NotConnectedError("AchievementsService.listAchievements");
  },
};
