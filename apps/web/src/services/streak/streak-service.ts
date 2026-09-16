import type { StreakSummary } from "@/types/threatlens-streak";

export interface StreakService {
  getMine(): Promise<StreakSummary>;
}
