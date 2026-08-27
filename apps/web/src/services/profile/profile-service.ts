import type { ProfileSummary, SkillMastery } from "@/types/profile";

export interface ProfileService {
  getSummary(): Promise<ProfileSummary>;
  listSkillMastery(): Promise<SkillMastery[]>;
}
