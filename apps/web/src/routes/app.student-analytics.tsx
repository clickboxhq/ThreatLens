import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { CohortPicker } from "@/components/soc/cohort-picker";
import { NoCohorts } from "@/components/soc/no-cohorts";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useSelectedCohort, useReviewQueue } from "@/hooks/use-instructor";

export const Route = createFileRoute("/app/student-analytics")({
  component: StudentAnalytics,
  head: () => ({
    meta: [
      { title: "ThreatLens · Student Analytics" },
      {
        name: "description",
        content: "Per-analyst scores and verdict accuracy across a cohort's submitted work.",
      },
      { property: "og:title", content: "ThreatLens · Student Analytics" },
      { property: "og:description", content: "Instructor view of graded analyst performance." },
    ],
  }),
});

function riskTone(percent: number | null) {
  if (percent == null) return "text-muted-foreground";
  if (percent < 60) return "text-[color:var(--critical)]";
  if (percent < 75) return "text-[color:var(--warning)]";
  return "text-[color:var(--success)]";
}

function StudentAnalytics() {
  const { isLoading, cohorts, selectedCohort, selectedCohortId, setSelectedCohortId } =
    useSelectedCohort();
  const queueQuery = useReviewQueue(selectedCohortId);

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Student Analytics" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedCohortId) {
    return <NoCohorts title="Student Analytics" />;
  }

  const items = queueQuery.data ?? [];
  const scored = items.filter((i) => i.overallPercent != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, i) => sum + (i.overallPercent ?? 0), 0) / scored.length)
    : null;
  const verdictAccuracy = scored.length
    ? Math.round((scored.filter((i) => i.verdictCorrect).length / scored.length) * 100)
    : null;
  const atRisk = scored.filter((i) => (i.overallPercent ?? 100) < 60).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Student Analytics"
        description={`Submitted work for ${selectedCohort?.name}, graded against hidden ground truth.`}
        actions={
          <CohortPicker
            cohorts={cohorts}
            selectedId={selectedCohortId}
            onChange={setSelectedCohortId}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Submissions
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{items.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Average score
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--success)]">
            {avgScore == null ? "—" : `${avgScore}%`}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Verdict accuracy
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {verdictAccuracy == null ? "—" : `${verdictAccuracy}%`}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Below 60%
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--critical)]">
            {atRisk}
          </div>
        </Panel>
      </div>

      <Panel padded={false} className="mt-6" title="Submissions">
        {queueQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description="Nothing in this cohort has been submitted for grading."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Analyst</th>
                  <th className="px-4 py-2.5 text-left">Scenario</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Score</th>
                  <th className="px-4 py-2.5 text-left">Verdict</th>
                  <th className="px-4 py-2.5 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((i) => (
                  <tr key={i.sessionId} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="font-medium">{i.studentDisplayName}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">
                        {i.studentEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">{i.scenarioTitle}</td>
                    <td className="px-4 py-3 capitalize text-secondary">{i.status}</td>
                    <td
                      className={`px-4 py-3 font-semibold tabular-nums ${riskTone(i.overallPercent)}`}
                    >
                      {i.overallPercent == null ? "—" : `${Math.round(i.overallPercent)}%`}
                    </td>
                    <td className="px-4 py-3">
                      {i.verdictCorrect == null ? (
                        "—"
                      ) : i.verdictCorrect ? (
                        <span className="text-[color:var(--success)]">Correct</span>
                      ) : (
                        <span className="text-[color:var(--critical)]">Incorrect</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {i.submittedAt ? new Date(i.submittedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
