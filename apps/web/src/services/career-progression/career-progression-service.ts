import type { CareerProgressionStatusDto } from "@/types/career-progression";

export interface CareerProgressionService {
  getMine(): Promise<CareerProgressionStatusDto>;
}
