import { useState } from "react";
import {
  useDeviceProfile,
  useDeviceProcessTree,
  useDeviceFiles,
  useDeviceNetwork,
  useDeviceHttpRequests,
  useIsolateDevice,
  useDeviceInsights,
} from "@/hooks/use-endpoints";
import {
  EntityDrawerShell,
  DrawerEmpty,
  EventRow,
  formatEventTime,
} from "@/components/soc/entity-drawer-shell";
import { ChevronRight, Loader2, ShieldOff } from "lucide-react";
import { InsightPrompts } from "@/components/soc/insight-prompts";
import { PivotableValue } from "@/components/soc/ui/pivotable-value";
import type { ProcessTreeNodeDto } from "@/types/threatlens-operations";

type Tab = "profile" | "processes" | "files" | "network" | "web";

const TABS = [
  ["profile", "Profile"],
  ["processes", "Process tree"],
  ["files", "File activity"],
  ["network", "Network"],
  ["web", "Web requests"],
] as const;

const RISK_TONE: Record<string, string> = {
  high: "text-[color:var(--critical)]",
  medium: "text-[color:var(--warning)]",
  low: "text-[color:var(--info)]",
  none: "text-muted-foreground",
};

/**
 * The endpoint pivot — "what actually ran on this machine, and what did it touch?". This is
 * the view the endpoint / malware / ransomware / web scenarios turn on: a credential-dumping
 * or fileless-persistence case is unreadable as a flat event list but obvious as a parent →
 * child process chain.
 */
export function DeviceDetailDrawer({
  sessionId,
  deviceId,
  onClose,
  locked,
  variant = "drawer",
  backTo,
  backLabel,
  quickPreviewLinkTo,
}: {
  sessionId: string;
  deviceId: string;
  onClose?: () => void;
  locked?: boolean;
  variant?: "drawer" | "page";
  backTo?: string;
  backLabel?: string;
  quickPreviewLinkTo?: string;
}) {
  const [tab, setTab] = useState<Tab>("processes");
  const { data: device, isPending } = useDeviceProfile(sessionId, deviceId);
  const insightsQuery = useDeviceInsights(sessionId, deviceId);
  const isolate = useIsolateDevice(sessionId);

  const isolated = device?.isolationStatus === "isolated";

  return (
    <EntityDrawerShell
      kind="Device"
      title={isPending ? "Loading…" : (device?.hostname ?? "Unknown device")}
      subtitle={device ? `${device.osPlatform} ${device.osVersion}` : undefined}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      onClose={onClose}
      variant={variant}
      backTo={backTo}
      backLabel={backLabel}
      quickPreviewLinkTo={quickPreviewLinkTo}
      headerBadges={
        device && (
          <>
            <span
              className={`rounded border border-border px-1.5 py-0.5 text-[10px] ${RISK_TONE[device.riskLevel] ?? ""}`}
            >
              Risk: {device.riskLevel}
            </span>
            {isolated && (
              <span className="rounded border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--critical)]">
                Isolated
              </span>
            )}
          </>
        )
      }
      footer={
        device && (
          <div className="flex items-center gap-3">
            <button
              disabled={locked || isolated || isolate.isPending}
              onClick={() => isolate.mutate(deviceId)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[color:var(--critical)]/50 px-3 text-[12px] text-[color:var(--critical)] hover:bg-[color:var(--critical)]/10 disabled:opacity-50"
            >
              <ShieldOff className="size-3.5" />
              {isolated
                ? "Device isolated"
                : isolate.isPending
                  ? "Isolating…"
                  : "Isolate this device"}
            </button>
            <span className="text-[11px] text-muted-foreground">
              Containment is scored — isolating a clean machine costs you the same as missing a
              compromised one.
            </span>
          </div>
        )
      }
    >
      {isPending || !device ? (
        <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
          <Loader2 className="size-4 animate-spin" /> Loading device…
        </div>
      ) : (
        <>
          {tab === "profile" && (
            <div className="space-y-4">
              <InsightPrompts insights={insightsQuery.data} isPending={insightsQuery.isPending} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
                <dt className="text-muted-foreground">Hostname</dt>
                <dd className="font-mono">{device.hostname}</dd>
                <dt className="text-muted-foreground">OS</dt>
                <dd>
                  {device.osPlatform} {device.osVersion}
                </dd>
                <dt className="text-muted-foreground">Risk level</dt>
                <dd className={RISK_TONE[device.riskLevel] ?? ""}>{device.riskLevel}</dd>
                <dt className="text-muted-foreground">Isolation</dt>
                <dd className={isolated ? "text-[color:var(--warning)]" : ""}>
                  {isolated ? "Isolated from the network" : "Not isolated"}
                </dd>
                <dt className="text-muted-foreground">Last seen</dt>
                <dd>{formatEventTime(device.lastSeenAt)}</dd>
              </dl>
            </div>
          )}
          {tab === "processes" && <ProcessTreeTab sessionId={sessionId} deviceId={deviceId} />}
          {tab === "files" && <FilesTab sessionId={sessionId} deviceId={deviceId} />}
          {tab === "network" && <NetworkTab sessionId={sessionId} deviceId={deviceId} />}
          {tab === "web" && <WebTab sessionId={sessionId} deviceId={deviceId} />}
        </>
      )}
    </EntityDrawerShell>
  );
}

function ProcessTreeTab({ sessionId, deviceId }: { sessionId: string; deviceId: string }) {
  const { data: roots, isPending } = useDeviceProcessTree(sessionId, deviceId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Rebuilding process tree…
      </div>
    );
  }
  if (!roots || roots.length === 0) {
    return <DrawerEmpty>No process activity recorded on this device.</DrawerEmpty>;
  }

  return (
    <div className="space-y-1">
      <p className="mb-3 text-[11.5px] text-muted-foreground">
        Parent → child execution chain. What launched what is usually the whole story: a document or
        installer spawning a shell is the pivot most endpoint cases hinge on.
      </p>
      {roots.map((node) => (
        <ProcessNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

function ProcessNode({ node, depth }: { node: ProcessTreeNodeDto; depth: number }) {
  const imageName = node.imagePath.split(/[\\/]/).pop() ?? node.imagePath;
  return (
    <div>
      <div
        className="rounded-md border border-border bg-background/40 px-2.5 py-2"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center gap-1.5">
          {depth > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
          <span className="truncate text-[12px] font-medium">{imageName}</span>
          {node.integrityLevel && (
            <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
              {node.integrityLevel}
            </span>
          )}
        </div>
        <div className="mt-1 break-all font-mono text-[10.5px] text-secondary">
          {node.commandLine}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {formatEventTime(node.occurredAt)}
          {node.parentImagePath && ` · parent: ${node.parentImagePath.split(/[\\/]/).pop()}`}
        </div>
      </div>
      {node.children.map((child) => (
        <div key={child.id} className="mt-1">
          <ProcessNode node={child} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function FilesTab({ sessionId, deviceId }: { sessionId: string; deviceId: string }) {
  const { data: files, isPending } = useDeviceFiles(sessionId, deviceId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading file activity…
      </div>
    );
  }
  if (!files || files.length === 0) {
    return <DrawerEmpty>No file activity recorded on this device.</DrawerEmpty>;
  }

  // Mass create/modify/delete in a short window is the ransomware and insider-exfil tell.
  const byAction = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.action] = (acc[f.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-[11.5px]">
        <span className="text-muted-foreground">{files.length} file events:</span>
        {Object.entries(byAction).map(([action, count]) => (
          <span key={action} className={count > 20 ? "text-[color:var(--warning)]" : ""}>
            {action} × {count}
          </span>
        ))}
      </div>
      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
        {files.map((f) => (
          <EventRow
            key={f.id}
            title={f.action}
            detail={f.filePath}
            meta={formatEventTime(f.occurredAt)}
          />
        ))}
      </ul>
    </div>
  );
}

function NetworkTab({ sessionId, deviceId }: { sessionId: string; deviceId: string }) {
  const { data: events, isPending } = useDeviceNetwork(sessionId, deviceId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading connections…
      </div>
    );
  }
  if (!events || events.length === 0) {
    return <DrawerEmpty>No network connections recorded for this device.</DrawerEmpty>;
  }

  // Beaconing and exfil both show up as volume to one destination — rolled up so the analyst
  // sees the shape before scrolling individual connections.
  const byRemote = new Map<string, { count: number; sent: number; received: number }>();
  for (const e of events) {
    const cur = byRemote.get(e.remoteIp) ?? { count: 0, sent: 0, received: 0 };
    cur.count += 1;
    cur.sent += e.bytesSent;
    cur.received += e.bytesReceived;
    byRemote.set(e.remoteIp, cur);
  }
  const top = [...byRemote.entries()].sort((a, b) => b[1].sent - a[1].sent).slice(0, 5);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Top destinations by data sent
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {top.map(([ip, s]) => (
            <EventRow
              key={ip}
              title={<PivotableValue value={ip} type="ip" />}
              meta={`${s.count} connection${s.count === 1 ? "" : "s"} · ${formatBytes(s.sent)} sent · ${formatBytes(s.received)} received`}
            />
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          All connections ({events.length})
        </div>
        <ul className="max-h-[40vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
          {events.map((e) => (
            <EventRow
              key={e.id}
              title={
                <span>
                  {e.direction} {e.protocol} →{" "}
                  <PivotableValue
                    value={e.remoteIp}
                    type="ip"
                    className="font-mono text-[12px] font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  />
                  :{e.remotePort}
                </span>
              }
              meta={`${formatEventTime(e.occurredAt)} · ${formatBytes(e.bytesSent)} sent · ${formatBytes(e.bytesReceived)} received`}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function WebTab({ sessionId, deviceId }: { sessionId: string; deviceId: string }) {
  const { data: requests, isPending } = useDeviceHttpRequests(sessionId, deviceId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Loading web requests…
      </div>
    );
  }
  if (!requests || requests.length === 0) {
    return <DrawerEmpty>No web requests recorded for this device.</DrawerEmpty>;
  }

  return (
    <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
      {requests.map((r) => (
        <EventRow
          key={r.id}
          tone={r.statusCode >= 500 ? "warning" : "normal"}
          title={`${r.method} ${r.statusCode}`}
          detail={r.url}
          meta={`${formatEventTime(r.occurredAt)} · from ${r.sourceIp} · ${r.userAgent}`}
        />
      ))}
    </ul>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
