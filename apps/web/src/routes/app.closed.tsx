import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useMySessions } from "@/hooks/use-sessions";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { CheckCircle2, XCircle } from "lucide-react";
import type { SessionListItemDto } from "@/types/threatlens-operations";

export const Route = createFileRoute("/app/closed")({
  component: ClosedCasesPage,
  head: () => ({ meta: [{ title: "ThreatLens · Closed Alerts & Cases" }] }),
});

type Filter = "all" | "scored" | "abandoned";

/**
 * The learning-review archive the brief asks for — not just "hide completed work," but a
 * place to review what happened. Reuses the case workspace's existing locked/scored view
 * (ScoreResult: rubric breakdown, missed evidence, missed techniques) as the review surface
 * rather than building a second copy of that content — every row here links straight into it.
 */
function ClosedCasesPage() {
  const { data, isPending } = useMySessions();
  const [filter, setFilter] = useState<Filter>("all");

  const closed = (data ?? []).filter(
    (s) => s.status === "scored" || s.status === "abandoned",
  );
  const visible = closed.filter((s) => filter === "all" || s.status === filter);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Closed Alerts & Cases"
        description="Every investigation you've completed — review your verdict, your score, and what you missed."
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All closed"],
            ["scored", "Scored"],
            ["abandoned", "Abandoned"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`transition-app rounded-full border px-3 py-1 text-[11.5px] ${
              filter === key
                ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/12 text-[color:var(--info)]"
                : "border-border text-secondary hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        {isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="Nothing closed yet"
            description="Investigations you complete or abandon will show up here for review."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((s) => (
              <ClosedRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ClosedRow({ session: s }: { session: SessionListItemDto }) {
  return (
    <li>
      <Link
        to="/app/cases/$id"
        params={{ id: s.id }}
        className="flex items-center justify-between gap-4 px-4 py-3 text-[12.5px] hover:bg-background/40"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{s.scenarioTitle}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {s.scenarioCategory} ·{" "}
            {s.submittedAt ? `closed ${formatRelativeTime(s.submittedAt)}` : "abandoned"}
          </div>
        </div>
        {s.status === "abandoned" ? (
          <span className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
            Abandoned
          </span>
        ) : (
          <>
            <div className="shrink-0 text-right">
              <div className="t-h2 tabular-nums">
                {s.overallPercent !== null ? Math.round(s.overallPercent) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">score</div>
            </div>
            <div className="shrink-0">
              {s.verdictCorrect === true && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-2 py-1 text-[11px] text-[color:var(--success)]">
                  <CheckCircle2 className="size-3.5" /> Correct verdict
                </span>
              )}
              {s.verdictCorrect === false && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 px-2 py-1 text-[11px] text-[color:var(--critical)]">
                  <XCircle className="size-3.5" /> Missed verdict
                </span>
              )}
            </div>
          </>
        )}
      </Link>
    </li>
  );
}
