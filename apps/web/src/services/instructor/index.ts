import { apiInstructorService } from "./api-instructor-service";
import type { InstructorService } from "./instructor-service";

export const instructorService: InstructorService = apiInstructorService;

export type { InstructorService } from "./instructor-service";
