import type { ProfileSummary } from "@/types/profile";
import type { ProfilePerformance } from "@/types/profile-performance";

export interface ProfileService {
  getSummary(): Promise<ProfileSummary>;
  /** Server-aggregated Performance Overview — GET /profile/performance. The category
   * breakdown it returns also backs the profile's skills-mastery bars. */
  getPerformance(): Promise<ProfilePerformance>;
}
