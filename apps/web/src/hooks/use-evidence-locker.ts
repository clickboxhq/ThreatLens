import { useQuery } from "@tanstack/react-query";
import { evidenceLockerService } from "@/services/evidence-locker";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";
import type { EvidenceCoverageItem } from "@/types/evidence-locker";

const EVENT_TABLE_COVERAGE_LABELS: Record<string, string> = {
  sign_in_events: "Identity",
  email_messages: "Email",
  cloud_events: "Cloud",
  process_events: "Endpoint",
  file_events: "Endpoint",
  network_events: "Network",
  http_requests: "Web",
};

export function useEvidenceLocker() {
  const artifactsQuery = useQuery({
    queryKey: [...queryKeys.evidenceLocker, "mine"],
    queryFn: () => evidenceLockerService.listMine(),
  });
  const artifacts = artifactsQuery.data ?? [];

  const investigationCount = new Set(artifacts.map((a) => a.sessionId)).size;
  const techniqueTaggedCount = artifacts.filter((a) => a.mitreTechnique !== null).length;

  const coverageCounts = new Map<string, number>();
  for (const a of artifacts) {
    const label = EVENT_TABLE_COVERAGE_LABELS[a.eventTable] ?? "Other";
    coverageCounts.set(label, (coverageCounts.get(label) ?? 0) + 1);
  }
  const coverageBySource: EvidenceCoverageItem[] = [...coverageCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    artifacts,
    stats: artifactsQuery.data
      ? {
          artifactsCollected: artifacts.length,
          investigationsCovered: investigationCount,
          techniqueTaggedPercent: artifacts.length
            ? Math.round((techniqueTaggedCount / artifacts.length) * 100)
            : 0,
        }
      : undefined,
    coverageBySource,
    state: deriveViewState(artifactsQuery),
  };
}
