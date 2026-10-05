import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useMyAssignedScenarios } from "@/hooks/use-organization-scenarios";
import { useLaunchScenario } from "@/hooks/use-investigations";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ApiError } from "@/lib/api-client";
import { ClipboardCheck, Clock, Loader2, PlayCircle } from "lucide-react";
import type {
  AssignedScenarioDto,
  AssignmentStatus,
} from "@/types/threatlens-organization-scenarios";

export const Route = createFileRoute("/app/assigned-scenarios")({
  component: AssignedScenariosPage,
  head: () => ({ meta: [{ title: "ThreatLens · Assigned Scenarios" }] }),
});

const STATUS_STYLE: Record<AssignmentStatus, { label: string; className: string }> = {
  assigned: { label: "Assigned", className: "bg-[color:var(--info)]/12 text-[color:var(--info)]" },
  in_progress: {
    label: "In Progress",
    className: "bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
  },
  completed: {
    label: "Completed",
    className: "bg-[color:var(--success)]/12 text-[color:var(--success)]",
  },
  overdue: {
    label: "Overdue",
    className: "bg-[color:var(--critical)]/12 text-[color:var(--critical)]",
  },
};

function StatusBadge({ status }: { status: AssignmentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function AssignedScenarioCard({ assignment }: { assignment: AssignedScenarioDto }) {
  const navigate = useNavigate();
  const launch = useLaunchScenario();
  const [error, setError] = useState<string | null>(null);
  const busy = launch.isPending;

  const canStart = assignment.status === "assigned" || assignment.status === "overdue";

  const start = async () => {
    setError(null);
    try {
      const { sessionId } = await launch.mutateAsync(assignment.scenarioId);
      navigate({ to: "/app/cases/$id", params: { id: sessionId } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start this scenario.");
    }
  };

  return (
    <Panel>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded border border-border bg-background px-1.5 py-0.5">
            {assignment.category}
          </span>
          <span className="capitalize">{assignment.difficulty}</span>
        </div>
        <StatusBadge status={assignment.status} />
      </div>

      <h3 className="mt-2 text-[14.5px] font-medium leading-snug">{assignment.title}</h3>
      <div className="mt-1 text-[11.5px] text-muted-foreground">
        Assigned by {assignment.organizationName}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-muted-foreground">Assigned</div>
          <div className="mt-0.5 font-medium">{formatRelativeTime(assignment.assignedAt)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Due</div>
          <div
            className={`mt-0.5 flex items-center gap-1 font-medium ${
              assignment.status === "overdue" ? "text-[color:var(--critical)]" : ""
            }`}
          >
            <Clock className="size-3" />
            {assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString() : "No due date"}
          </div>
        </div>
      </div>

      {assignment.status === "completed" && assignment.scorePercent !== null && (
        <div className="mt-3 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[12px]">
          Score: <span className="font-semibold">{Math.round(assignment.scorePercent)}%</span>
        </div>
      )}

      {error && <p className="mt-2 text-[11.5px] text-[color:var(--critical)]">{error}</p>}

      {canStart && (
        <button
          disabled={busy}
          onClick={start}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Starting…
            </>
          ) : (
            <>
              <PlayCircle className="size-4" /> Start investigation
            </>
          )}
        </button>
      )}
      {assignment.status === "in_progress" && (
        <button
          onClick={() =>
            navigate({ to: "/app/scenarios", search: { slug: assignment.scenarioSlug } })
          }
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background py-2 text-[12px] text-secondary hover:text-foreground"
        >
          Continue in Scenario Library
        </button>
      )}
    </Panel>
  );
}

function AssignedScenariosPage() {
  const { assignments, isPending, isError } = useMyAssignedScenarios(true);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Assigned Scenarios"
        description="Investigation scenarios your organization has assigned to you."
      />

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState title="Couldn't load your assignments" description="Try reloading the page." />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No assigned scenarios"
          description="Your organization hasn't assigned any investigation scenarios to you yet."
          icon={<ClipboardCheck className="size-5" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assignments.map((a) => (
            <AssignedScenarioCard key={a.assignmentId} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
