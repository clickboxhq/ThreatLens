import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { useReports } from "@/hooks/use-reports";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Reports" }] }),
});

const VERDICT_LABELS: Record<string, string> = {
  true_positive: "True positive",
  false_positive: "False positive",
  benign_positive: "Benign positive",
};

function ReportsPage() {
  const { reports, state } = useReports();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Reports"
        description="The final report for every incident you've closed — notes, evidence, timeline, and verdict."
      />

      {state === "empty" ? (
        <Panel>
          <div className="py-12 text-center">
            <FileText className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-[13px] font-medium">No closed incidents yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-secondary">
              Close an incident with a verdict during an investigation and its final report will
              show up here.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Incident</th>
                  <th className="px-4 py-2.5 text-left">Scenario</th>
                  <th className="px-4 py-2.5 text-left">Verdict</th>
                  <th className="px-4 py-2.5 text-left">Closed</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((r) => (
                  <tr key={r.incidentId} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="font-medium">{r.incidentTitle}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">{r.scenarioTitle}</td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                        {r.verdict ? (VERDICT_LABELS[r.verdict] ?? r.verdict) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.closedAt
                        ? new Date(r.closedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/app/reports/$sessionId/$incidentId"
                        params={{ sessionId: r.sessionId, incidentId: r.incidentId }}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
                      >
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
