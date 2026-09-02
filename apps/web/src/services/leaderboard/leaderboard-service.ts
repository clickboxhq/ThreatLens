import type {
  LeaderboardDto,
  LeaderboardPeriod,
  LeaderboardScope,
} from "@/types/threatlens-learning";

export interface LeaderboardService {
  get(
    period: LeaderboardPeriod,
    scope: LeaderboardScope,
    cohortId?: string,
  ): Promise<LeaderboardDto>;
}
