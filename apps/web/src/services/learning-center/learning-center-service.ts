import type { CourseDto, LearningPathDto } from "@/types/socverse-learning";

export interface LearningCenterService {
  listCourses(): Promise<CourseDto[]>;
  getPath(pathId: string): Promise<LearningPathDto>;
}
