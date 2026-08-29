import { apiProfileService } from "./api-profile-service";
import type { ProfileService } from "./profile-service";

export const profileService: ProfileService = apiProfileService;
export type { ProfileService } from "./profile-service";
