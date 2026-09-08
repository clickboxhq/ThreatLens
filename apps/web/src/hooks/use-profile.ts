import { useQuery } from "@tanstack/react-query";
import { profileService } from "@/services/profile";
import { certificatesService } from "@/services/certificates";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";
import type { SkillMastery } from "@/types/profile";

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function useProfile() {
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.profile, "summary"],
    queryFn: () => profileService.getSummary(),
  });
  const performanceQuery = useQuery({
    queryKey: [...queryKeys.profile, "performance"],
    queryFn: () => profileService.getPerformance(),
  });
  const certificatesQuery = useQuery({
    queryKey: queryKeys.certificates,
    queryFn: () => certificatesService.listCertificates(),
  });

  // Skills-mastery bars are just the category breakdown the performance endpoint already
  // returns — derived here, not re-fetched.
  const skillMastery: SkillMastery[] = (performanceQuery.data?.categoryBreakdown ?? [])
    .map((entry) => ({
      label: humanizeCategory(entry.category),
      value: Math.round(entry.averagePercent),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: summaryQuery.data,
    performance: performanceQuery.data,
    performanceState: deriveViewState(
      performanceQuery,
      (data) => data.investigationsCompleted === 0,
    ),
    skillMastery,
    certificates: certificatesQuery.data ?? [],
    state: deriveViewState(summaryQuery),
  };
}
