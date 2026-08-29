import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { EntityTypeIcon } from "@/components/soc/ui/entity-icon";
import { useReport } from "@/hooks/use-reports";
import { ArrowLeft, Award, Loader2, Pin } from "lucide-react";

export const Route = createFileRoute("/app/reports/$sessionId/$incidentId")({
  component: ReportDetailPage,
  head: () => ({ meta: [{ title: "ThreatLens · Incident Report" }] }),
});

const VERDICT_LABELS: Record<string, string> = {
  true_positive: "True positive",
  false_positive: "False positive",
  benign_positive: "Benign positive",
};

function ReportDetailPage() {
  const { sessionId, incidentId } = useParams({
    from: "/app/reports/$sessionId/$incidentId",
  });
  const { report, isPending, isError } = useReport(sessionId, incidentId);

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-[13px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading report…
      </div>
    );
  }
  if (isError || !report) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-sm text-secondary">Could not load this report.</p>
        <Link to="/app/reports" className="mt-3 inline-block text-[13px] text-[color:var(--info)]">
          Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/app/reports"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to Reports
      </Link>
      <SectionHeader
        title={report.incident.title}
        description={
          report.incident.closedAt
            ? `Closed ${new Date(report.incident.closedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
            : undefined
        }
        actions={
          <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary">
            {report.incident.verdict
              ? (VERDICT_LABELS[report.incident.verdict] ?? report.incident.verdict)
              : "No verdict"}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Summary">
            <p className="text-[13px] text-secondary">
              {report.incident.summary || "No summary was provided."}
            </p>
            {report.incident.techniques.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.incident.techniques.map((t) => (
                  <span
                    key={t.id}
                    className="rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 font-mono text-[10.5px] text-[color:var(--info)]"
                  >
                    {t.techniqueId} — {t.name}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Timeline" padded={false}>
            {report.timeline.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
                No events were curated onto the timeline.
              </p>
            ) : (
              <ol className="relative ml-7 border-l border-border py-3 pr-4">
                {report.timeline.map((e) => (
                  <li key={e.id} className="relative py-2.5 pl-5">
                    <span className="absolute -left-[5px] top-4 size-2 rounded-full bg-[color:var(--info)]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {new Date(e.occurredAt).toISOString().slice(0, 16).replace("T", " ")} UTC
                      </span>
                      {e.source.map((s) => (
                        <span
                          key={s}
                          className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[12px] text-secondary">{e.summary}</p>
                    <div className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
                      <EntityTypeIcon type={e.entityType} />
                      {e.entityType} · {e.entityLabel}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Analyst notes" padded={false}>
            {report.notes.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
                No notes were added.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto px-4 py-3">
                {report.notes.map((n) => (
                  <div
                    key={n.id}
                    className="mb-3 rounded-md border border-border bg-background/40 p-2.5"
                  >
                    <p className="text-[12.5px] text-secondary">{n.body}</p>
                    <div className="mt-1 text-[10.5px] text-muted-foreground">
                      {new Date(n.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          {report.score && (
            <Panel title="Score">
              <div className="flex items-end gap-2">
                <div className="text-[28px] font-semibold tabular-nums">
                  {Math.round(report.score.overallPercent)}
                </div>
                <div className="pb-1 text-[11.5px] text-muted-foreground">/ 100</div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                <Award className="size-3.5 text-[color:var(--info)]" />
                <span
                  className={
                    report.score.verdictCorrect
                      ? "text-[color:var(--success)]"
                      : "text-[color:var(--high)]"
                  }
                >
                  {report.score.verdictCorrect ? "Verdict correct" : "Verdict incorrect"}
                </span>
              </div>
            </Panel>
          )}

          <Panel title="Evidence" padded={false}>
            {report.evidence.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
                No evidence was pinned.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {report.evidence.map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium">
                      <Pin className="size-3.5 text-muted-foreground" />
                      {e.summary}
                    </div>
                    <p className="mt-1 text-[11px] text-secondary">{e.justification}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
