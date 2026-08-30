import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/soc/primitives";
import { sessionsService } from "@/services/sessions";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { History } from "lucide-react";

/**
 * The learner's own record of how they worked the case — Sentinel and Defender both keep one
 * of these per incident.
 *
 * Two uses, and the second is the one that matters for teaching. During the investigation it
 * answers "have I already looked at this?". Afterwards it is the record of how a conclusion
 * was reached: someone who scored badly can see that they pinned two things and never opened
 * the device, which is a far more useful lesson than a percentage.
 *
 * Counts only, with no judgement attached — "enough" depends entirely on the case, and three
 * pins can be thorough work on a simple alert or a rushed job on a complex one.
 */
export function ActivityLogPanel({ sessionId }: { sessionId: string | undefined }) {
  const { data, isPending } = useQuery({
    queryKey: ["session", sessionId, "activity"],
    queryFn: () => sessionsService.getActivity(sessionId!),
    enabled: Boolean(sessionId),
  });

  if (isPending || !data || data.summary.totalActions === 0) return null;

  const s = data.summary;
  const stats: [string, number][] = [
    ["opened", s.entitiesOpened],
    ["pinned", s.evidencePinned],
    ["searches", s.searchesRun],
    ["actions", s.responseActionsTaken],
    ["hints", s.hintsUnlocked],
  ];

  return (
    <Panel
      title="Your activity"
      actions={
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {s.totalActions} steps
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 rounded-md border border-border bg-background/40 px-2.5 py-2">
        {stats
          .filter(([, n]) => n > 0)
          .map(([label, n]) => (
            <span key={label} className="text-[11px] text-muted-foreground">
              <span className="tabular-nums text-secondary">{n}</span> {label}
            </span>
          ))}
      </div>

      <div className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
        {data.entries.slice(0, 40).map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 text-[11.5px]">
            <History className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 leading-[1.5] text-secondary">{entry.summary}</span>
            <span className="shrink-0 tabular-nums text-[10.5px] text-muted-foreground">
              {formatRelativeTime(entry.occurredAt)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
