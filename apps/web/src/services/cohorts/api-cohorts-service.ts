import { apiClient } from "@/lib/api-client";
import type { CohortsService } from "./cohorts-service";
import type { MyAssignmentDto, MyCohortDto } from "@/types/socverse-instructor";

export const apiCohortsService: CohortsService = {
  join: (joinCode) =>
    apiClient.post<{ cohortId: string; cohortName: string; enrolledAt: string }>("/cohorts/join", {
      joinCode,
    }),

  listMine: () => apiClient.get<MyCohortDto[]>("/cohorts/mine"),

  listMyAssignments: () => apiClient.get<MyAssignmentDto[]>("/cohorts/mine/assignments"),
};
