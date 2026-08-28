import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useOwnedCohorts, useCreateCohort } from "@/hooks/use-instructor";
import { Plus, Users } from "lucide-react";

export const Route = createFileRoute("/app/cohorts")({
  component: Cohorts,
  head: () => ({
    meta: [
      { title: "ThreatLens · Cohorts" },
      {
        name: "description",
        content: "Create and manage analyst cohorts and their join codes.",
      },
      { property: "og:title", content: "ThreatLens · Cohorts" },
      {
        property: "og:description",
        content: "Cohort rosters and enrollment for SOC training programs.",
      },
    ],
  }),
});

function Cohorts() {
  const cohortsQuery = useOwnedCohorts();
  const createCohort = useCreateCohort();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const cohorts = cohortsQuery.data ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCohort.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName("");
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Cohorts"
        description="Groups of analysts enrolled by join code, each with their own assigned scenarios."
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="size-3.5" /> New cohort
          </button>
        }
      />

      {showForm && (
        <Panel className="mb-4">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[220px] flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Cohort name
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fall 2026 SOC Fundamentals"
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={createCohort.isPending || !name.trim()}
              className="h-9 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {createCohort.isPending ? "Creating…" : "Create"}
            </button>
          </form>
          {createCohort.isError && (
            <p className="mt-2 text-[12px] text-[color:var(--critical)]">
              Couldn't create that cohort — try again.
            </p>
          )}
        </Panel>
      )}

      <Panel padded={false}>
        {cohortsQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : cohorts.length === 0 ? (
          <EmptyState
            title="No cohorts yet"
            description="Create your first cohort to get a join code analysts can enroll with."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Cohort</th>
                  <th className="px-4 py-2.5 text-left">Join code</th>
                  <th className="px-4 py-2.5 text-left">Enrolled</th>
                  <th className="px-4 py-2.5 text-left">Assignments</th>
                  <th className="px-4 py-2.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cohorts.map((c) => (
                  <tr key={c.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/app/instructor"
                        className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-[color:var(--info)]"
                      >
                        <Users className="size-3.5 text-muted-foreground" /> {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] tracking-wider">{c.joinCode}</td>
                    <td className="px-4 py-3 tabular-nums">{c.enrollmentCount}</td>
                    <td className="px-4 py-3 tabular-nums">{c.assignmentCount}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
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
