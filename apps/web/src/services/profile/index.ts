import type { ProfileService } from "./profile-service";
import { mockProfileService } from "./mock-profile-service";

export const profileService: ProfileService = mockProfileService;
export type { ProfileService } from "./profile-service";
