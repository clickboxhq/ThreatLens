import type { InstructorCohort } from "@/types/instructor";

export interface InstructorService {
  listCohorts(): Promise<InstructorCohort[]>;
}
