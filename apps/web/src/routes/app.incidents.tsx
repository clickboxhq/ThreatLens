import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { useIncidents } from "@/hooks/use-incidents";
import { ArrowUpRight, Search } from "lucide-react";

export const Route = createFileRoute("/app/incidents")({
  component: IncidentsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Incidents" }] }),
});

function IncidentsPage() {
  const { incidents } = useIncidents();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Incident Queue"
        description="Correlated multi-alert incidents ranked by risk and blast radius."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-9 flex-1 min-w-[260px] items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-muted-foreground">
          <Search className="size-3.5" />
          <input
            className="flex-1 bg-transparent text-foreground focus:outline-none"
            placeholder="Search incidents…"
          />
        </div>
        {["All", "Critical", "High", "Escalated", "Assigned to me"].map((t, i) => (
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
      </div>

      <Panel padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Incident</th>
                <th className="px-4 py-2.5 text-left">Severity</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Alerts</th>
                <th className="px-4 py-2.5 text-left">Entities</th>
                <th className="px-4 py-2.5 text-left">Owner</th>
                <th className="px-4 py-2.5 text-right">Updated</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidents.map((i) => (
                <tr key={i.id} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{i.title}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {i.id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge level={i.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-secondary">{i.alerts}</td>
                  <td className="px-4 py-3 tabular-nums text-secondary">{i.entities}</td>
                  <td className="px-4 py-3 text-secondary">{i.owner}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{i.updated}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      to="/app/cases/$id"
                      params={{ id: i.id }}
                      className="inline-flex items-center gap-1 text-[color:var(--info)] hover:opacity-80"
                    >
                      Open case <ArrowUpRight className="size-3" />
                    </Link>
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
