import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { useEndpoints } from "@/hooks/use-endpoints";
import { Cpu, Filter, Lock, Wifi } from "lucide-react";

export const Route = createFileRoute("/app/endpoints")({
  component: EndpointCenter,
  head: () => ({ meta: [{ title: "ThreatLens · Endpoint Center" }] }),
});

function statusTone(s: string) {
  if (s === "At risk")
    return "text-[color:var(--critical)] bg-[color:var(--critical)]/10 ring-[color:var(--critical)]/25";
  if (s === "Isolated")
    return "text-[color:var(--high)] bg-[color:var(--high)]/10 ring-[color:var(--high)]/25";
  if (s === "Investigating")
    return "text-[color:var(--warning)] bg-[color:var(--warning)]/10 ring-[color:var(--warning)]/25";
  return "text-[color:var(--success)] bg-[color:var(--success)]/10 ring-[color:var(--success)]/25";
}

function EndpointCenter() {
  const { endpoints } = useEndpoints();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Endpoint Center"
        description="Fleet posture, processes, network, and containment across managed devices."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Devices online", "8,224"],
          ["At risk", "31", "text-[color:var(--critical)]"],
          ["Isolated", "4", "text-[color:var(--high)]"],
          ["Avg. risk score", "27", "text-[color:var(--success)]"],
        ].map(([l, v, t]) => (
          <Panel key={l as string}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${t ?? ""}`}>{v}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-6 mb-3 flex items-center gap-2">
        {["All", "At risk", "Isolated", "Servers", "Workstations"].map((t, i) => (
          <button
            key={t}
            className={`h-9 rounded-md border px-3 text-[12px] ${
              i === 0
                ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                : "border-border bg-card text-secondary hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        <button className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12px] text-secondary">
          <Filter className="size-3.5" /> Filters
        </button>
      </div>

      <Panel padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Host</th>
                <th className="px-4 py-2.5 text-left">OS</th>
                <th className="px-4 py-2.5 text-left">Owner</th>
                <th className="px-4 py-2.5 text-left">Risk</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">IP</th>
                <th className="px-4 py-2.5 text-right">Last seen</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {endpoints.map((e) => (
                <tr key={e.host} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-3.5 text-muted-foreground" />
                      <span className="font-mono">{e.host}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{e.os}</td>
                  <td className="px-4 py-3 text-secondary">{e.owner}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{e.risk}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ${statusTone(e.status)}`}
                    >
                      {e.status === "Isolated" && <Lock className="size-3" />}
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Wifi className="size-3 text-muted-foreground" /> {e.ip}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{e.lastSeen}</td>
                  <td className="px-3 py-3 text-right">
                    <button className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground">
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
