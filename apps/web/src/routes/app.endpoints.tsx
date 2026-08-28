import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { SessionPicker } from "@/components/soc/session-picker";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useActiveSession } from "@/hooks/use-active-session";
import { useEndpoints, useIsolateDevice } from "@/hooks/use-endpoints";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { Cpu, Lock } from "lucide-react";
import type { DeviceRiskLevel } from "@/types/socverse-operations";

export const Route = createFileRoute("/app/endpoints")({
  component: EndpointCenter,
  head: () => ({ meta: [{ title: "ThreatLens · Endpoint Center" }] }),
});

function riskTone(level: DeviceRiskLevel) {
  if (level === "high") return "text-[color:var(--critical)]";
  if (level === "medium") return "text-[color:var(--high)]";
  if (level === "low") return "text-[color:var(--warning)]";
  return "text-[color:var(--success)]";
}

function EndpointCenter() {
  const {
    isLoading: sessionsLoading,
    activeSessions,
    selectedSessionId,
    setSelectedSessionId,
  } = useActiveSession();
  const endpointsQuery = useEndpoints(selectedSessionId);
  const isolate = useIsolateDevice(selectedSessionId);

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Endpoint Center" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedSessionId) {
    return <NoActiveSession title="Endpoint Center" />;
  }

  const devices = endpointsQuery.data ?? [];
  const isolated = devices.filter((d) => d.isolationStatus === "isolated").length;
  const atRisk = devices.filter((d) => d.riskLevel === "high").length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Endpoint Center"
        description="Device posture and containment within this investigation."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Devices</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{devices.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">At risk</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--critical)]">
            {atRisk}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Isolated</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--high)]">
            {isolated}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">OS mix</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {new Set(devices.map((d) => d.osPlatform)).size}
          </div>
        </Panel>
      </div>

      <Panel padded={false} className="mt-6">
        {endpointsQuery.isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <EmptyState title="No devices" description="This session has no generated devices." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Host</th>
                  <th className="px-4 py-2.5 text-left">OS</th>
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Last seen</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="size-3.5 text-muted-foreground" />
                        <span className="font-mono">{d.hostname}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {d.osPlatform} {d.osVersion}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold capitalize ${riskTone(d.riskLevel)}`}>
                        {d.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {d.isolationStatus === "isolated" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--high)]/10 px-2 py-0.5 text-[11px] text-[color:var(--high)] ring-1 ring-inset ring-[color:var(--high)]/25">
                          <Lock className="size-3" /> Isolated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--success)]/10 px-2 py-0.5 text-[11px] text-[color:var(--success)] ring-1 ring-inset ring-[color:var(--success)]/25">
                          Connected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatRelativeTime(d.lastSeenAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {d.isolationStatus !== "isolated" && (
                        <button
                          disabled={isolate.isPending}
                          onClick={() => isolate.mutate(d.id)}
                          className="rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 px-2 py-1 text-[11px] text-[color:var(--critical)] hover:bg-[color:var(--critical)]/20 disabled:opacity-50"
                        >
                          Isolate
                        </button>
                      )}
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
