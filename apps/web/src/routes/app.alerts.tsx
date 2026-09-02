import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel, SectionHeader, SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { SessionPicker } from "@/components/soc/session-picker";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IdentityDetailDrawer } from "@/components/soc/identity-detail-drawer";
import { DeviceDetailDrawer } from "@/components/soc/device-detail-drawer";
import { useActiveSession } from "@/hooks/use-active-session";
import { useAlerts, useUpdateAlertStatus, useAlertEvidence } from "@/hooks/use-alerts";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { Check, X as XIcon } from "lucide-react";
import type {
  AlertDto,
  AlertEntityType,
  AlertSeverity,
  AlertStatus,
} from "@/types/threatlens-operations";
import type { Severity, Status } from "@/components/soc/primitives";

export const Route = createFileRoute("/app/alerts")({
  component: AlertsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Alerts" }] }),
});

const SEVERITY_LABEL: Record<AlertSeverity, Severity> = {
  informational: "info",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const STATUS_LABEL: Record<AlertStatus, Status> = {
  new: "new",
  in_progress: "in-progress",
  resolved: "resolved",
  dismissed: "closed",
};

// Saved views a solo analyst actually uses. No "My Alerts"/"Unassigned" here — this training
// platform has no multi-analyst assignment concept on an alert (confirmed: AlertDto carries no
// assignee field, and there's no assign endpoint), so a view implying one would be decorative.
// Every view below is a real, deterministic filter over data that already exists.
type SavedView = {
  key: string;
  label: string;
  test: (a: AlertDto) => boolean;
};
const SAVED_VIEWS: SavedView[] = [
  { key: "all", label: "All alerts", test: () => true },
  { key: "critical", label: "Critical", test: (a) => a.severity === "critical" },
  {
    key: "high-plus",
    label: "High severity+",
    test: (a) => a.severity === "critical" || a.severity === "high",
  },
  { key: "new", label: "New", test: (a) => a.status === "new" },
  { key: "phishing", label: "Phishing / email", test: (a) => a.primaryEntityType === "mailbox" },
  { key: "identity", label: "Identity", test: (a) => a.primaryEntityType === "identity" },
  { key: "endpoint", label: "Endpoint", test: (a) => a.primaryEntityType === "device" },
];

function AlertsPage() {
  const {
    isLoading: sessionsLoading,
    activeSessions,
    selectedSessionId,
    setSelectedSessionId,
  } = useActiveSession();
  const alertsQuery = useAlerts(selectedSessionId);
  const updateStatus = useUpdateAlertStatus(selectedSessionId);
  // An alert names the entity it fired on ("Possible LSASS memory dump on IT-WKS-07") and
  // carries its id, but until now the queue dead-ended there: you had to go find that host
  // yourself among every other device in the session. The alert is where an investigation
  // actually starts, so it pivots straight into the entity.
  // "Why did this fire?" — the rule's own working, one click from the row it belongs to.
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [openIdentityId, setOpenIdentityId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [savedView, setSavedView] = useState("all");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [mitreFilter, setMitreFilter] = useState<string | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const mitreTechniques = useMemo(() => {
    const all = alertsQuery.data ?? [];
    return [
      ...new Map(
        all
          .filter((a) => a.mitreTechnique)
          .map((a) => [a.mitreTechnique!.techniqueId, a.mitreTechnique!]),
      ).values(),
    ];
  }, [alertsQuery.data]);

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Alert Center" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedSessionId) {
    return <NoActiveSession title="Alert Center" />;
  }

  const allAlerts = alertsQuery.data ?? [];
  const activeView = SAVED_VIEWS.find((v) => v.key === savedView) ?? SAVED_VIEWS[0];

  const alerts = allAlerts.filter(
    (a) =>
      activeView.test(a) &&
      (severityFilter === "all" || a.severity === severityFilter) &&
      (statusFilter === "all" || a.status === statusFilter) &&
      (mitreFilter === "all" || a.mitreTechnique?.techniqueId === mitreFilter),
  );

  const selectableIds = alerts
    .filter((a) => a.status === "new" || a.status === "in_progress")
    .map((a) => a.id);
  const allSelectableChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected(allSelectableChecked ? new Set() : new Set(selectableIds));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkResolve = async () => {
    const ids = [...selected];
    let ok = 0;
    for (const alertId of ids) {
      try {
        await updateStatus.mutateAsync({ alertId, status: "resolved" });
        ok++;
      } catch {
        // individual failure surfaced via the count below; keep going for the rest
      }
    }
    setSelected(new Set());
    if (ok === ids.length) toast.success(`Resolved ${ok} alert${ok === 1 ? "" : "s"}`);
    else toast.error(`Resolved ${ok} of ${ids.length} — try the rest again`);
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Alert Center"
        description="Triage the alerts your current investigation's telemetry has fired."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />

      {updateStatus.isError && (
        <div className="mb-3 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 px-3 py-2 text-[12px] text-[color:var(--critical)]">
          Couldn't update that alert — try again.
        </div>
      )}

      {/* Saved views */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {SAVED_VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setSavedView(v.key)}
            className={`transition-app rounded-full border px-3 py-1 text-[11.5px] ${
              savedView === v.key
                ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/12 text-[color:var(--info)]"
                : "border-border text-secondary hover:text-foreground"
            }`}
          >
            {v.label}
            {v.key !== "all" && (
              <span className="ml-1.5 tabular-nums opacity-70">
                {allAlerts.filter(v.test).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | "all")}
          className="h-8 rounded-md border border-border bg-card px-2 text-[11.5px] text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All severities</option>
          {(["critical", "high", "medium", "low", "informational"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AlertStatus | "all")}
          className="h-8 rounded-md border border-border bg-card px-2 text-[11.5px] text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All statuses</option>
          {(["new", "in_progress", "resolved", "dismissed"] as const).map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        {mitreTechniques.length > 0 && (
          <select
            value={mitreFilter}
            onChange={(e) => setMitreFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-card px-2 text-[11.5px] text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All MITRE techniques</option>
            {mitreTechniques.map((t) => (
              <option key={t.techniqueId} value={t.techniqueId}>
                {t.techniqueId} — {t.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-muted-foreground">
          {alerts.length} of {allAlerts.length} alerts
        </span>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-[color:var(--info)]/40 bg-[color:var(--info)]/10 px-3 py-2 text-[12px]">
          <span className="font-medium text-[color:var(--info)]">{selected.size} selected</span>
          <button
            onClick={bulkResolve}
            disabled={updateStatus.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--info)]/40 bg-card px-2.5 py-1 text-[11.5px] text-foreground hover:bg-background disabled:opacity-50"
          >
            <Check className="size-3.5" /> Mark resolved
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-secondary hover:text-foreground"
          >
            <XIcon className="size-3.5" /> Clear
          </button>
        </div>
      )}

      <Panel padded={false}>
        {alertsQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            title="No alerts yet"
            description="This investigation's telemetry hasn't fired any detections."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-9 px-4 py-2.5">
                    {selectableIds.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allSelectableChecked}
                        onChange={toggleAll}
                        className="size-3.5 rounded border-border accent-[color:var(--info)]"
                        aria-label="Select all"
                      />
                    )}
                  </th>
                  <th className="px-4 py-2.5 text-left">Alert</th>
                  <th className="px-4 py-2.5 text-left">Severity</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">MITRE</th>
                  <th className="px-4 py-2.5 text-left">Entity</th>
                  <th className="px-4 py-2.5 text-right">Last seen</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts.map((a) => (
                  <Fragment key={a.id}>
                    <tr className="transition-app hover:bg-background/40">
                      <td className="px-4 py-3">
                        {(a.status === "new" || a.status === "in_progress") && (
                          <input
                            type="checkbox"
                            checked={selected.has(a.id)}
                            onChange={() => toggleOne(a.id)}
                            className="size-3.5 rounded border-border accent-[color:var(--info)]"
                            aria-label={`Select ${a.title}`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setExpandedAlertId((prev) => (prev === a.id ? null : a.id))
                          }
                          className="text-left"
                        >
                          <div className="font-medium text-foreground hover:text-[color:var(--info)]">
                            {a.title}
                          </div>
                          <div className="mt-0.5 max-w-md text-[11px] text-muted-foreground">
                            {a.description}
                          </div>
                          <div className="mt-1 text-[10.5px] text-[color:var(--info)]">
                            {expandedAlertId === a.id ? "Hide" : "Why did this fire?"}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge level={SEVERITY_LABEL[a.severity]} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={STATUS_LABEL[a.status]} />
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-secondary">
                        {a.mitreTechnique?.techniqueId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {a.entityDisplay && a.primaryEntityType !== "mailbox" ? (
                          <button
                            onClick={() =>
                              a.primaryEntityType === "identity"
                                ? setOpenIdentityId(a.primaryEntityId)
                                : setOpenDeviceId(a.primaryEntityId)
                            }
                            className="text-left text-[color:var(--info)] underline-offset-2 hover:underline"
                          >
                            {a.entityDisplay}
                          </button>
                        ) : (
                          <span className="text-secondary">{a.entityDisplay ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {formatRelativeTime(a.lastSeenAt)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {a.status === "new" || a.status === "in_progress" ? (
                          <button
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              updateStatus.mutate({ alertId: a.id, status: "resolved" })
                            }
                            className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground disabled:opacity-50"
                          >
                            Mark resolved
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedAlertId === a.id && (
                      <tr className="bg-background/40">
                        <td colSpan={8} className="px-4 pb-3">
                          <AlertEvidence sessionId={selectedSessionId!} alertId={a.id} />
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

      {openIdentityId && selectedSessionId && (
        <IdentityDetailDrawer
          sessionId={selectedSessionId}
          identityId={openIdentityId}
          onClose={() => setOpenIdentityId(null)}
          quickPreviewLinkTo={`/app/identity/${selectedSessionId}/${openIdentityId}`}
        />
      )}
      {openDeviceId && selectedSessionId && (
        <DeviceDetailDrawer
          sessionId={selectedSessionId}
          deviceId={openDeviceId}
          onClose={() => setOpenDeviceId(null)}
          quickPreviewLinkTo={`/app/endpoints/${selectedSessionId}/${openDeviceId}`}
        />
      )}
    </div>
  );
}

/** The events a detection fired on, shown inline under its row. Surfaces the rule's working
 * so a learner can see the reasoning rather than infer it — and so the pivot from "an alert
 * exists" to "here is the telemetry behind it" takes one click instead of a manual hunt. */
function AlertEvidence({ sessionId, alertId }: { sessionId: string; alertId: string }) {
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
