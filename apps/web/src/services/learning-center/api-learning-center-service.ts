import { apiClient } from "@/lib/api-client";
import type { LearningCenterService } from "./learning-center-service";
import type { CourseDto, LearningPathDto } from "@/types/threatlens-learning";

export const apiLearningCenterService: LearningCenterService = {
  listCourses: () => apiClient.get<CourseDto[]>("/learning/courses"),

  getPath: (pathId) => apiClient.get<LearningPathDto>(`/learning/paths/${pathId}`),
};
