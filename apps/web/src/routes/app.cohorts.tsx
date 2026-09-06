import { Fragment, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useOwnedCohorts, useCreateCohort, useArchiveCohort } from "@/hooks/use-instructor";
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Plus, Users } from "lucide-react";
import { CohortStaffing } from "@/components/soc/cohort-staffing";

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
  // Archived cohorts are out of the way by default but never gone — last term's grades and
  // feedback still have to be reachable.
  const [showArchived, setShowArchived] = useState(false);
  const cohortsQuery = useOwnedCohorts(showArchived);
  const archiveCohort = useArchiveCohort();
  const createCohort = useCreateCohort();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  // Staffing and groups are per-cohort, so they expand inline rather than needing a route of
  // their own — a cohort list is short and this keeps the two visible together.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="size-3.5"
              />
              Show archived
            </label>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="size-3.5" /> New cohort
            </button>
          </div>
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
                  <th className="px-4 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cohorts.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="hover:bg-background/40">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          aria-expanded={expandedId === c.id}
                          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-[color:var(--info)]"
                        >
                          {expandedId === c.id ? (
                            <ChevronDown className="size-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          )}
                          <Users className="size-3.5 text-muted-foreground" /> {c.name}
                          {c.archivedAt && (
                            <span className="ml-1.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                              Archived
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] tracking-wider">
                        {c.joinCode}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{c.enrollmentCount}</td>
                      <td className="px-4 py-3 tabular-nums">{c.assignmentCount}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
                        <td colSpan={6} className="bg-background/30 px-4 py-4">
                          <CohortStaffing cohortId={c.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
