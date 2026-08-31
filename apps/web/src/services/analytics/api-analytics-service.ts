import { sessionsService } from "@/services/sessions";
import type { AnalyticsService } from "./analytics-service";
import type { SessionListItemDto } from "@/types/threatlens-operations";

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short" });
}

export const apiAnalyticsService: AnalyticsService = {
  listInvestigationActivity: async () => {
    const sessions = await sessionsService.listMine();
    const buckets = new Map<string, { label: string; started: number; completed: number }>();
    for (const s of sessions) {
      const key = monthKey(s.startedAt);
      const bucket = buckets.get(key) ?? {
        label: monthLabel(s.startedAt),
        started: 0,
        completed: 0,
      };
      bucket.started += 1;
      if (s.status === "scored") bucket.completed += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => ({ m: b.label, started: b.started, completed: b.completed }));
  },

  listTimeToResolution: async () => {
    const sessions = await sessionsService.listMine();
    const withDuration = sessions.filter(
      (s): s is SessionListItemDto & { submittedAt: string } => s.submittedAt !== null,
    );
    const buckets = new Map<string, { label: string; minutes: number[] }>();
    for (const s of withDuration) {
      const key = monthKey(s.startedAt);
      const bucket = buckets.get(key) ?? { label: monthLabel(s.startedAt), minutes: [] };
      bucket.minutes.push(
        (new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000,
      );
      buckets.set(key, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, b]) => ({
        m: b.label,
        minutes: Math.round(b.minutes.reduce((sum, v) => sum + v, 0) / b.minutes.length),
      }));
  },

  listMitreCoverage: async () => {
    const entries = await sessionsService.getSkillRadar();
    return entries.map((e) => ({ tactic: e.tacticName, cov: e.percent }));
  },
};
