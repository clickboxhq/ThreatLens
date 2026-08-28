import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { CohortPicker } from "@/components/soc/cohort-picker";
import { NoCohorts } from "@/components/soc/no-cohorts";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useSelectedCohort, useRoster } from "@/hooks/use-instructor";
import { UserRound } from "lucide-react";

export const Route = createFileRoute("/app/instructor")({
  component: InstructorPortal,
  head: () => ({ meta: [{ title: "ThreatLens · Instructor Portal" }] }),
});

function InstructorPortal() {
  const { isLoading, cohorts, selectedCohort, selectedCohortId, setSelectedCohortId } =
    useSelectedCohort();
  const rosterQuery = useRoster(selectedCohortId);

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Instructor Portal" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedCohortId) {
    return <NoCohorts title="The Instructor Portal" />;
  }

  const roster = rosterQuery.data ?? [];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Instructor Portal"
        description={`Roster for ${selectedCohort?.name}.`}
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Enrolled</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{roster.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--success)]">
            {roster.filter((r) => r.status === "active").length}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Join code
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tracking-wider">
            {selectedCohort?.joinCode}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Assignments
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {selectedCohort?.assignmentCount ?? 0}
          </div>
        </Panel>
      </div>

      <Panel padded={false} className="mt-6" title="Roster">
        {rosterQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <EmptyState
            title="No one's enrolled yet"
            description={`Share the join code ${selectedCohort?.joinCode} with your analysts.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Analyst</th>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.map((r) => (
                  <tr key={r.userId} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <UserRound className="size-3.5 text-muted-foreground" /> {r.displayName}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-secondary">{r.email}</td>
                    <td className="px-4 py-3 capitalize text-secondary">{r.status}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(r.enrolledAt).toLocaleDateString()}
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
