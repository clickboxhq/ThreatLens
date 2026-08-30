import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import { useInvestigationTasks } from "@/hooks/use-investigations";
import { Check, ChevronDown, ChevronRight, ListChecks } from "lucide-react";

/**
 * The investigation checklist — Microsoft Sentinel attaches one of these to every incident so
 * an analyst works a defined procedure instead of improvising from raw telemetry.
 *
 * Deliberately NOT scored and NOT required. The moment ticking boxes earns marks, it stops
 * being a thinking aid and becomes a form to fill in — learners would optimise for the
 * checkmarks rather than the investigation. It is a place to keep your method honest, and
 * the copy says so.
 */
export function InvestigationChecklist({
  sessionId,
  incidentId,
  locked,
}: {
  sessionId: string | undefined;
  incidentId: string | undefined;
  locked: boolean;
}) {
  const { tasks, completedCount, totalCount, isPending, toggleTask } = useInvestigationTasks(
    sessionId,
    incidentId,
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isPending || totalCount === 0) return null;

  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <Panel
      title="Investigation checklist"
      actions={
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
      }
    >
      <div className="mb-3 flex items-start gap-2.5 rounded-md border border-border bg-background/40 px-2.5 py-2">
        <ListChecks className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-[1.6] text-muted-foreground">
          Standard procedure for this kind of investigation. Not scored — it is here to keep your
          method honest, not to be completed.
        </p>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-[color:var(--info)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-0.5">
        {tasks.map((task) => {
          const open = expanded === task.key;
          return (
            <div key={task.key} className="rounded-md">
              <div className="flex items-start gap-2 px-1 py-1.5">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggleTask({ taskKey: task.key, completed: !task.completed })}
                  aria-label={
                    task.completed ? `Mark "${task.label}" not done` : `Mark "${task.label}" done`
                  }
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    task.completed
                      ? "border-[color:var(--success)] bg-[color:var(--success)]/15 text-[color:var(--success)]"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  {task.completed && <Check className="size-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : task.key)}
                  className="flex flex-1 items-start gap-1.5 text-left"
                >
                  <span
                    className={`flex-1 text-[12px] leading-[1.5] transition-colors ${
                      task.completed ? "text-muted-foreground line-through" : "text-secondary"
                    }`}
                  >
                    {task.label}
                  </span>
                  {open ? (
                    <ChevronDown className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </div>

              {open && (
                <p className="ml-7 mr-1 pb-2 text-[11px] leading-[1.65] text-muted-foreground">
                  {task.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
