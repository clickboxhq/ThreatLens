import type { CourseDto, LearningPathDto } from "@/types/threatlens-learning";

export interface LearningCenterService {
  listCourses(): Promise<CourseDto[]>;
  getPath(pathId: string): Promise<LearningPathDto>;
}
