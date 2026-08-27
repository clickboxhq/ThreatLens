import type {
  LearningTrack,
  LearningAchievement,
  LearningCertificate,
} from "@/types/learning-center";

export interface LearningCenterService {
  listTracks(): Promise<LearningTrack[]>;
  listAchievements(): Promise<LearningAchievement[]>;
  listCertificates(): Promise<LearningCertificate[]>;
}
