import type { InstructorService } from "./instructor-service";
import { mockInstructorService } from "./mock-instructor-service";

export const instructorService: InstructorService = mockInstructorService;
export type { InstructorService } from "./instructor-service";
