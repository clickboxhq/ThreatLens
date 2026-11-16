import { useAlertEvidence } from "@/hooks/use-alerts";

/** The events a detection fired on, shown inline under its row. Surfaces the rule's working
 * so a learner can see the reasoning rather than infer it — and so the pivot from "an alert
 * exists" to "here is the telemetry behind it" takes one click instead of a manual hunt.
 * Shared by the Alert Center and the case workspace's Triage stage. */
export function AlertEvidence({ sessionId, alertId }: { sessionId: string; alertId: string }) {
  const { data, isPending, isError } = useAlertEvidence(sessionId, alertId);

  if (isPending) {
    return <div className="py-2 text-[11.5px] text-muted-foreground">Loading evidence…</div>;
  }
  if (isError || !data) {
    return (
      <div className="py-2 text-[11.5px] text-muted-foreground">
        Could not load what triggered this alert.
      </div>
    );
  }
  if (data.evidence.length === 0) {
    return (
      <div className="py-2 text-[11.5px] text-muted-foreground">
        This alert recorded no individual triggering events.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        What triggered this alert · {data.evidence.length}{" "}
        {data.evidence.length === 1 ? "event" : "events"}
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {data.evidence.map((e) => (
          <li key={`${e.eventTable}:${e.eventId}`} className="flex items-baseline gap-2">
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {new Date(e.occurredAt).toISOString().slice(11, 16)}
            </span>
            <span className="text-[11.5px] text-secondary">{e.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
