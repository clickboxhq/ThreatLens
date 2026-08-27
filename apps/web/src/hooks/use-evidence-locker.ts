import { useQuery } from "@tanstack/react-query";
import { evidenceLockerService } from "@/services/evidence-locker";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useEvidenceLocker() {
  const artifactsQuery = useQuery({
    queryKey: [...queryKeys.evidenceLocker, "artifacts"],
    queryFn: () => evidenceLockerService.listArtifacts(),
  });
  const statsQuery = useQuery({
    queryKey: [...queryKeys.evidenceLocker, "stats"],
    queryFn: () => evidenceLockerService.getStats(),
  });
  const coverageQuery = useQuery({
    queryKey: [...queryKeys.evidenceLocker, "coverage"],
    queryFn: () => evidenceLockerService.listCoverageBySource(),
  });
  const gradingImpactQuery = useQuery({
    queryKey: [...queryKeys.evidenceLocker, "grading-impact"],
    queryFn: () => evidenceLockerService.listGradingImpact(),
  });
  return {
    artifacts: artifactsQuery.data ?? [],
    stats: statsQuery.data,
    coverageBySource: coverageQuery.data ?? [],
    gradingImpact: gradingImpactQuery.data ?? [],
    state: deriveViewState(artifactsQuery),
  };
}
