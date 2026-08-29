import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, SectionHeader, SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { SessionPicker } from "@/components/soc/session-picker";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IdentityDetailDrawer } from "@/components/soc/identity-detail-drawer";
import { DeviceDetailDrawer } from "@/components/soc/device-detail-drawer";
import { useActiveSession } from "@/hooks/use-active-session";
import { useAlerts, useUpdateAlertStatus } from "@/hooks/use-alerts";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AlertSeverity, AlertStatus } from "@/types/socverse-operations";
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
  const [openIdentityId, setOpenIdentityId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);

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

  const alerts = alertsQuery.data ?? [];

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
                  <tr key={a.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{a.title}</div>
                      <div className="mt-0.5 max-w-md text-[11px] text-muted-foreground">
                        {a.description}
                      </div>
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
                          onClick={() => updateStatus.mutate({ alertId: a.id, status: "resolved" })}
                          className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground disabled:opacity-50"
                        >
                          Mark resolved
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
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
        />
      )}
      {openDeviceId && selectedSessionId && (
        <DeviceDetailDrawer
          sessionId={selectedSessionId}
          deviceId={openDeviceId}
          onClose={() => setOpenDeviceId(null)}
        />
      )}
    </div>
  );
}
