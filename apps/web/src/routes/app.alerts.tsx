import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader, SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { useAlerts } from "@/hooks/use-alerts";
import { Bookmark, Filter, Search, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/app/alerts")({
  component: AlertsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Alerts" }] }),
});

function AlertsPage() {
  const { alerts } = useAlerts();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Alert Center"
        description="Triage, assign, and investigate alerts across identity, endpoint, email, and cloud."
        actions={
          <>
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground">
              <Bookmark className="size-3.5" /> Saved views
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
              Assign selected
            </button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        <div className="flex h-9 flex-1 min-w-[260px] items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] text-muted-foreground">
          <Search className="size-3.5" />
          <input
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="Filter by alert, rule, user, device, MITRE ID…"
          />
        </div>
        {["Severity", "Status", "MITRE", "Source", "Analyst", "Time"].map((f) => (
          <button
            key={f}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] text-secondary hover:text-foreground"
          >
            <Filter className="size-3" /> {f}
          </button>
        ))}
        <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] text-secondary hover:text-foreground">
          <SlidersHorizontal className="size-3.5" /> Columns
        </button>
      </div>

      {/* Table */}
      <div className="shadow-elev overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2.5 text-left">
                  <input type="checkbox" className="accent-[color:var(--info)]" />
                </th>
                <th className="px-3 py-2.5 text-left">Alert</th>
                <th className="px-3 py-2.5 text-left">Severity</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-left">MITRE</th>
                <th className="px-3 py-2.5 text-left">Source</th>
                <th className="px-3 py-2.5 text-left">User</th>
                <th className="px-3 py-2.5 text-left">Device</th>
                <th className="px-3 py-2.5 text-left">Analyst</th>
                <th className="px-3 py-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-background/40">
                  <td className="px-3 py-3">
                    <input type="checkbox" className="accent-[color:var(--info)]" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-foreground">{a.name}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {a.id} · {a.rule}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <SeverityBadge level={a.severity} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-3 text-secondary">{a.mitre}</td>
                  <td className="px-3 py-3 text-secondary">{a.source}</td>
                  <td className="px-3 py-3 font-mono text-[11.5px] text-secondary">{a.user}</td>
                  <td className="px-3 py-3 font-mono text-[11.5px] text-secondary">{a.device}</td>
                  <td className="px-3 py-3 text-secondary">{a.analyst}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {a.ts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
          <span>Showing 8 of 248 alerts</span>
          <div className="flex items-center gap-2">
            <button className="rounded border border-border px-2 py-1">Prev</button>
            <button className="rounded border border-border px-2 py-1">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
