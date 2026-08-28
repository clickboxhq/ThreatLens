import { apiLearningCenterService } from "./api-learning-center-service";
import type { LearningCenterService } from "./learning-center-service";

export const learningCenterService: LearningCenterService = apiLearningCenterService;

export type { LearningCenterService } from "./learning-center-service";
