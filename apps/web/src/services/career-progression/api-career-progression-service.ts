import { apiClient } from "@/lib/api-client";
import type { CareerProgressionService } from "./career-progression-service";
import type { CareerProgressionStatusDto } from "@/types/career-progression";

export const apiCareerProgressionService: CareerProgressionService = {
  getMine: () => apiClient.get<CareerProgressionStatusDto>("/career-progression/mine"),
};
