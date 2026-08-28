import type { MyAssignmentDto, MyCohortDto } from "@/types/socverse-instructor";

/** Student-facing side of instructor mode — joining a cohort by code and seeing what's been
 * assigned. Any authenticated student can reach this; managing a cohort is instructor-only
 * (see services/instructor). */
export interface CohortsService {
  join(joinCode: string): Promise<{ cohortId: string; cohortName: string; enrolledAt: string }>;
  listMine(): Promise<MyCohortDto[]>;
  listMyAssignments(): Promise<MyAssignmentDto[]>;
}
