import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { CohortPicker } from "@/components/soc/cohort-picker";
import { NoCohorts } from "@/components/soc/no-cohorts";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import {
  useSelectedCohort,
  useAssignments,
  useCreateAssignment,
  useCohortGroups,
} from "@/hooks/use-instructor";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/app/assessments")({
  component: Assessments,
  head: () => ({
    meta: [
      { title: "ThreatLens · Assessments" },
      {
        name: "description",
        content: "Assign investigation scenarios to a cohort, with due dates and attempt limits.",
      },
      { property: "og:title", content: "ThreatLens · Assessments" },
      { property: "og:description", content: "Scenario assignments and attempt limits by cohort." },
    ],
  }),
});

function Assessments() {
  const { isLoading, cohorts, selectedCohort, selectedCohortId, setSelectedCohortId } =
    useSelectedCohort();
  const assignmentsQuery = useAssignments(selectedCohortId);
  const groupsQuery = useCohortGroups(selectedCohortId);
  const createAssignment = useCreateAssignment(selectedCohortId);
  const scenariosQuery = useQuery({
    queryKey: ["scenarios", "catalog"],
    queryFn: listRealScenarios,
  });

  const [showForm, setShowForm] = useState(false);
  const [scenarioId, setScenarioId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [attemptLimit, setAttemptLimit] = useState("");
  // "" targets the whole cohort. Groups are optional, so this stays out of the way until the
  // instructor has actually created one.
  const [groupId, setGroupId] = useState("");

  if (isLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Assessments" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedCohortId) {
    return <NoCohorts title="Assessments" />;
  }

  const assignments = assignmentsQuery.data ?? [];
  const scenarios = scenariosQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioId) return;
    createAssignment.mutate(
      {
        scenarioId,
        groupId: groupId || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        attemptLimit: attemptLimit ? Number(attemptLimit) : undefined,
      },
      {
        onSuccess: () => {
          setScenarioId("");
          setGroupId("");
          setDueAt("");
          setAttemptLimit("");
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Assessments"
        description={`Scenarios assigned to ${selectedCohort?.name}.`}
        actions={
          <>
            <CohortPicker
              cohorts={cohorts}
              selectedId={selectedCohortId}
              onChange={setSelectedCohortId}
            />
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="size-3.5" /> Assign scenario
            </button>
          </>
        }
      />

      {showForm && (
        <Panel className="mb-4">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[220px] flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Scenario
              </span>
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              >
                <option value="">Select a scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            {/* Only shown once groups exist — a cohort without them assigns to everyone, and an
             * always-visible "Whole cohort" dropdown would imply a choice that is not there. */}
            {groups.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Assign to
                </span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
                >
                  <option value="">Whole cohort</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.studentCount})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Due date
              </span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Attempt limit
              </span>
              <input
                type="number"
                min={1}
                value={attemptLimit}
                onChange={(e) => setAttemptLimit(e.target.value)}
                placeholder="Unlimited"
                className="h-9 w-28 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={createAssignment.isPending || !scenarioId}
              className="h-9 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {createAssignment.isPending ? "Assigning…" : "Assign"}
            </button>
          </form>
          {createAssignment.isError && (
            <p className="mt-2 text-[12px] text-[color:var(--critical)]">
              Couldn't create that assignment — try again.
            </p>
          )}
        </Panel>
      )}

      <Panel padded={false}>
        {assignmentsQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            title="Nothing assigned yet"
            description="Assign a scenario above to give this cohort something to work on."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Scenario</th>
                  <th className="px-4 py-2.5 text-left">Assigned to</th>
                  <th className="px-4 py-2.5 text-left">Due</th>
                  <th className="px-4 py-2.5 text-left">Attempt limit</th>
                  <th className="px-4 py-2.5 text-right">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-background/40">
                    <td className="px-4 py-3 font-medium">{a.scenarioTitle}</td>
                    <td className="px-4 py-3 text-secondary">{a.groupName ?? "Whole cohort"}</td>
                    <td className="px-4 py-3 text-secondary">
                      {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "No due date"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-secondary">
                      {a.attemptLimit ?? "Unlimited"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString()}
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
