import { useState } from "react";
import { Panel, SeverityBadge } from "@/components/soc/primitives";
import { AlertEvidence } from "@/components/soc/alert-evidence";
import { DismissAlertDialog } from "@/components/soc/dismiss-alert-dialog";
import { Skeleton } from "@/components/soc/ui/skeleton";
import { ArrowUpRight, Ban, CheckCircle2, MonitorSmartphone, Undo2, UserRound } from "lucide-react";
import type { AlertDto, AlertSeverity } from "@/types/threatlens-operations";
import type { Severity } from "@/components/soc/primitives";

const SEVERITY_LABEL: Record<AlertSeverity, Severity> = {
  informational: "info",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

type Bucket = "open" | "escalated" | "dismissed";

// "Resolved" and a stray in_progress both land in "open": neither is a decision the score
// recognises, and the whole point of this stage is that every alert gets one.
function bucketFor(alert: AlertDto, linkedIds: Set<string>): Bucket {
  if (linkedIds.has(alert.id)) return "escalated";
  if (alert.status === "dismissed") return "dismissed";
  return "open";
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

/**
 * Triage: the queue, inside the case. Every alert the session's telemetry fired, and for
 * each one the decision an analyst actually makes — is this the incident, or is it noise?
 * Escalating links the alert to the incident (and is what the graph's relations are drawn
 * from); dismissing records a reason. Both are reversible until submission, and both are
 * scored, as is leaving an alert undecided.
 */
export function StageTriage({
  sessionId,
  alerts,
  alertsLoading,
  linkedAlertIds,
  locked,
  busy,
  onEscalate,
  onUnescalate,
  onDismiss,
  onUndismiss,
  onOpenIdentity,
  onOpenDevice,
}: {
  sessionId: string;
  alerts: AlertDto[];
  alertsLoading: boolean;
  linkedAlertIds: string[];
  locked: boolean;
  busy: boolean;
  onEscalate: (alertId: string) => Promise<unknown>;
  onUnescalate: (alertId: string) => Promise<unknown>;
  onDismiss: (alertId: string, reason: string) => Promise<unknown>;
  onUndismiss: (alertId: string) => Promise<unknown>;
  onOpenIdentity: (id: string) => void;
  onOpenDevice: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<AlertDto | null>(null);

  const linked = new Set(linkedAlertIds);
  const sorted = [...alerts].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
  const open = sorted.filter((a) => bucketFor(a, linked) === "open");
  const escalated = sorted.filter((a) => bucketFor(a, linked) === "escalated");
  const dismissed = sorted.filter((a) => bucketFor(a, linked) === "dismissed");
  const decided = escalated.length + dismissed.length;

  const renderRow = (a: AlertDto, bucket: Bucket) => {
    const expanded = expandedId === a.id;
    const canPivot = a.entityDisplay && a.primaryEntityType !== "mailbox";
    return (
      <li
        key={a.id}
        className={`px-4 py-3 ${
          bucket === "escalated"
            ? "border-l-2 border-[color:var(--info)] bg-[color:var(--info)]/[0.04]"
            : bucket === "dismissed"
              ? "opacity-70"
              : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={SEVERITY_LABEL[a.severity]} />
              <span className="text-[12.5px] font-medium">{a.title}</span>
              {a.mitreTechnique && (
                <span
                  title={a.mitreTechnique.name}
                  className="font-mono text-[10.5px] text-secondary"
                >
                  {a.mitreTechnique.techniqueId}
                </span>
              )}
              {a.dedupCount > 1 && (
                <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ×{a.dedupCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-secondary">{a.description}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
              {canPivot ? (
                <button
                  onClick={() =>
                    a.primaryEntityType === "identity"
                      ? onOpenIdentity(a.primaryEntityId)
                      : onOpenDevice(a.primaryEntityId)
                  }
                  className="inline-flex items-center gap-1 rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 text-[10.5px] text-[color:var(--info)] hover:bg-[color:var(--info)]/10"
                >
                  {a.primaryEntityType === "identity" ? (
                    <UserRound className="size-3" />
                  ) : (
                    <MonitorSmartphone className="size-3" />
                  )}
                  {a.entityDisplay}
                </button>
              ) : (
                a.entityDisplay && <span>{a.entityDisplay}</span>
              )}
              <button
                onClick={() => setExpandedId(expanded ? null : a.id)}
                className="text-[color:var(--info)] hover:underline"
              >
                {expanded ? "Hide" : "Why did this fire?"}
              </button>
            </div>
            {expanded && (
              <div className="mt-2">
                <AlertEvidence sessionId={sessionId} alertId={a.id} />
              </div>
            )}
            {bucket === "dismissed" && a.dismissalReason && (
              <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                Dismissed: {a.dismissalReason}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5">
            {bucket === "open" && (
              <>
                <button
                  disabled={locked || busy}
                  onClick={() => onEscalate(a.id)}
                  className="inline-flex h-7 items-center gap-1 rounded border border-[color:var(--info)]/50 bg-[color:var(--info)]/10 px-2 text-[11px] text-[color:var(--info)] hover:bg-[color:var(--info)]/20 disabled:opacity-40"
                >
                  <ArrowUpRight className="size-3" /> Escalate
                </button>
                <button
                  disabled={locked || busy}
                  onClick={() => setDismissing(a)}
                  className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] text-secondary hover:text-foreground disabled:opacity-40"
                >
                  <Ban className="size-3" /> Dismiss…
                </button>
              </>
            )}
            {bucket === "escalated" && (
              <button
                disabled={locked || busy}
                onClick={() => onUnescalate(a.id)}
                title="Remove from this incident"
                className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] text-secondary hover:text-foreground disabled:opacity-40"
              >
                <Undo2 className="size-3" /> Remove
              </button>
            )}
            {bucket === "dismissed" && (
              <button
                disabled={locked || busy}
                onClick={() => onUndismiss(a.id)}
                title="Put it back in the queue"
                className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] text-secondary hover:text-foreground disabled:opacity-40"
              >
                <Undo2 className="size-3" /> Undo
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const group = (title: string, items: AlertDto[], bucket: Bucket, empty: string) => (
    <Panel
      title={title}
      actions={<span className="text-[11px] text-muted-foreground">{items.length}</span>}
      padded={false}
    >
      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">{items.map((a) => renderRow(a, bucket))}</ul>
      )}
    </Panel>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="max-w-xl text-[12.5px] leading-relaxed text-secondary">
          Decide which alerts are this incident. <span className="text-foreground">Escalate</span>{" "}
          what belongs; <span className="text-foreground">dismiss</span> what doesn&apos;t, and say
          why. Both are scored — and so is leaving an alert undecided. Escalating is not a verdict:
          an incident can turn out to be authorised, and you say so when you submit.
        </p>
        <div className="flex items-center gap-2 text-[11.5px]">
          {alerts.length > 0 && decided === alerts.length ? (
            <span className="inline-flex items-center gap-1 text-[color:var(--success)]">
              <CheckCircle2 className="size-3.5" /> All {alerts.length} decided
            </span>
          ) : (
            <span className="tabular-nums text-muted-foreground">
              {decided} of {alerts.length} decided
            </span>
          )}
        </div>
      </div>

      {alertsLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <>
          {group(
            "Needs a decision",
            open,
            "open",
            alerts.length === 0
              ? "No detections fired on this session's telemetry."
              : "Every alert has a decision. You can still change your mind below.",
          )}
          {group(
            "Escalated to this incident",
            escalated,
            "escalated",
            "Nothing escalated yet. The alerts you escalate are what the investigation graph connects.",
          )}
          {group("Dismissed", dismissed, "dismissed", "Nothing dismissed.")}
        </>
      )}

      <DismissAlertDialog
        open={dismissing !== null}
        onOpenChange={(open) => !open && setDismissing(null)}
        alertTitles={dismissing ? [dismissing.title] : []}
        onConfirm={async (reason) => {
          if (dismissing) await onDismiss(dismissing.id, reason);
        }}
      />
    </div>
  );
}
