import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { SessionPicker } from "@/components/soc/session-picker";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { PivotableValue } from "@/components/soc/ui/pivotable-value";
import { formatEventTime } from "@/components/soc/entity-drawer-shell";
import { useActiveSession } from "@/hooks/use-active-session";
import { useSessionNetwork } from "@/hooks/use-network";
import { useEndpoints } from "@/hooks/use-endpoints";
import { ArrowDown, ArrowUp, Network } from "lucide-react";
import type { NetworkEventDto } from "@/types/socverse-operations";

export const Route = createFileRoute("/app/network")({
  component: NetworkCenter,
  head: () => ({ meta: [{ title: "ThreatLens · Network Center" }] }),
});

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type DirectionFilter = "all" | "inbound" | "outbound";

/**
 * Network Center — the session-wide counterpart to a device's own Network tab. A single host's
 * connection list can't show a destination that several hosts are all quietly talking to, which
 * is exactly the shape a beaconing or lateral-movement finding takes; this pulls every device's
 * NetworkEvent rows into one place and rolls them up by destination first, same as the
 * per-device tab already does, just across the whole investigation instead of one machine.
 */
function NetworkCenter() {
  const { isLoading: sessionsLoading, activeSessions, selectedSessionId, setSelectedSessionId } =
    useActiveSession();

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Network Center" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!selectedSessionId) {
    return <NoActiveSession title="Network Center" />;
  }

  return (
    <NetworkCenterInner
      sessionId={selectedSessionId}
      activeSessions={activeSessions}
      selectedSessionId={selectedSessionId}
      setSelectedSessionId={setSelectedSessionId}
    />
  );
}

function NetworkCenterInner({
  sessionId,
  activeSessions,
  selectedSessionId,
  setSelectedSessionId,
}: {
  sessionId: string;
  activeSessions: ReturnType<typeof useActiveSession>["activeSessions"];
  selectedSessionId: string | undefined;
  setSelectedSessionId: (id: string) => void;
}) {
  const { data: events, isPending } = useSessionNetwork(sessionId);
  const { data: devices } = useEndpoints(sessionId);
  const hostnameFor = useMemo(() => {
    const byId = new Map<string, string>();
    for (const d of devices ?? []) byId.set(d.id, d.hostname);
    return (id: string) => byId.get(id) ?? id.slice(0, 8);
  }, [devices]);

  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [remoteIpQuery, setRemoteIpQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");

  const all = events ?? [];
  const filtered = all.filter((e) => {
    if (direction !== "all" && e.direction !== direction) return false;
    if (deviceFilter !== "all" && e.deviceId !== deviceFilter) return false;
    if (remoteIpQuery && !e.remoteIp.includes(remoteIpQuery.trim())) return false;
    return true;
  });

  // Rolled up by destination across every device — the shape that reveals one IP quietly
  // talking to several hosts, which no single device's own Network tab could ever show.
  const byRemote = new Map<
    string,
    { count: number; sent: number; received: number; deviceIds: Set<string> }
  >();
  for (const e of filtered) {
    const cur = byRemote.get(e.remoteIp) ?? {
      count: 0,
      sent: 0,
      received: 0,
      deviceIds: new Set<string>(),
    };
    cur.count += 1;
    cur.sent += e.bytesSent;
    cur.received += e.bytesReceived;
    cur.deviceIds.add(e.deviceId);
    byRemote.set(e.remoteIp, cur);
  }
  const topDestinations = [...byRemote.entries()]
    .sort((a, b) => b[1].sent + b[1].received - (a[1].sent + a[1].received))
    .slice(0, 8);

  const totalSent = filtered.reduce((sum, e) => sum + e.bytesSent, 0);
  const totalReceived = filtered.reduce((sum, e) => sum + e.bytesReceived, 0);
  const uniqueDestinations = byRemote.size;
  const multiHostDestinations = [...byRemote.values()].filter((v) => v.deviceIds.size > 1).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Network Center"
        description="Every recorded connection across every device in this investigation."
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Connections</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{filtered.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Destinations</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{uniqueDestinations}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Seen from 2+ hosts
          </div>
          <div
            className={`mt-1 text-2xl font-semibold tabular-nums ${multiHostDestinations > 0 ? "text-[color:var(--warning)]" : ""}`}
          >
            {multiHostDestinations}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sent / Received</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatBytes(totalSent)} <span className="text-muted-foreground">/</span>{" "}
            {formatBytes(totalReceived)}
          </div>
        </Panel>
      </div>

      {topDestinations.length > 0 && (
        <Panel title="Top destinations by traffic volume" className="mt-4" padded={false}>
          <ul className="divide-y divide-border">
            {topDestinations.map(([ip, s]) => (
              <li key={ip} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                <PivotableValue value={ip} type="ip" />
                {s.deviceIds.size > 1 && (
                  <span className="rounded-md bg-[color:var(--warning)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--warning)] ring-1 ring-inset ring-[color:var(--warning)]/25">
                    {s.deviceIds.size} hosts
                  </span>
                )}
                <span className="flex-1" />
                <span className="text-muted-foreground">
                  {s.count} connection{s.count === 1 ? "" : "s"}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatBytes(s.sent + s.received)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {(["all", "outbound", "inbound"] as DirectionFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] capitalize transition-colors ${
                direction === d
                  ? "bg-[color:var(--info)]/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "outbound" && <ArrowUp className="size-3" />}
              {d === "inbound" && <ArrowDown className="size-3" />}
              {d}
            </button>
          ))}
        </div>
        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-[11.5px] outline-none"
        >
          <option value="all">All devices</option>
          {(devices ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.hostname}
            </option>
          ))}
        </select>
        <input
          value={remoteIpQuery}
          onChange={(e) => setRemoteIpQuery(e.target.value)}
          placeholder="Filter by remote IP…"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[11.5px] font-mono outline-none placeholder:font-sans focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Panel padded={false}>
        {isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Network className="size-6" />}
            title="No connections"
            description="No network telemetry matches this filter for this investigation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Host</th>
                  <th className="px-4 py-2.5 text-left">Direction</th>
                  <th className="px-4 py-2.5 text-left">Protocol</th>
                  <th className="px-4 py-2.5 text-left">Remote</th>
                  <th className="px-4 py-2.5 text-right">Sent</th>
                  <th className="px-4 py-2.5 text-right">Received</th>
                  <th className="px-4 py-2.5 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(0, 300).map((e: NetworkEventDto) => (
                  <tr key={e.id} className="hover:bg-background/40">
                    <td className="px-4 py-2.5 font-mono">{hostnameFor(e.deviceId)}</td>
                    <td className="px-4 py-2.5 capitalize text-secondary">{e.direction}</td>
                    <td className="px-4 py-2.5 uppercase text-secondary">{e.protocol}</td>
                    <td className="px-4 py-2.5">
                      <PivotableValue value={e.remoteIp} type="ip" />
                      <span className="text-muted-foreground">:{e.remotePort}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatBytes(e.bytesSent)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatBytes(e.bytesReceived)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {formatEventTime(e.occurredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 300 && (
              <p className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
                Showing the first 300 of {filtered.length} connections — narrow the filter to see more.
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
