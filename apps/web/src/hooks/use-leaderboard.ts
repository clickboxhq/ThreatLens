import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "@/services/leaderboard";
import { cohortsService } from "@/services/cohorts";
import type { LeaderboardPeriod } from "@/types/threatlens-learning";

/**
 * Ranks a learner against the people they actually share a classroom with, and falls back to
 * an anonymised platform-wide standing for anyone not in a cohort.
 *
 * The global board spans every organisation, so it deliberately carries no names — the API
 * withholds them rather than the UI hiding them, since hiding them client-side would leave
 * the disclosure intact over the wire.
 */
export function useLeaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all_time");

  const cohortsQuery = useQuery({
    queryKey: ["cohorts", "mine"],
    queryFn: () => cohortsService.listMine(),
  });
  const cohort = cohortsQuery.data?.[0];

  const query = useQuery({
    // Keyed by cohort so switching between them refetches rather than showing stale ranks.
    queryKey: ["leaderboard", cohort?.id ?? "global", period],
    queryFn: () =>
      cohort
        ? leaderboardService.get(period, "cohort", cohort.id)
        : leaderboardService.get(period, "global"),
    // Wait until we know whether they are in a cohort, or the first paint asks for the
    // wrong board and the numbers visibly change underneath them.
    enabled: !cohortsQuery.isPending,
  });

  return {
    period,
    setPeriod,
    leaderboard: query.data,
    cohortName: cohort?.name ?? null,
    isPending: cohortsQuery.isPending || query.isPending,
    isError: query.isError,
  };
}
