import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useIdentities } from "@/hooks/use-identities";
import { Filter, MapPin, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/identity")({
  component: IdentityCenter,
  head: () => ({ meta: [{ title: "ThreatLens · Identity Center" }] }),
});

function riskTone(r: number) {
  if (r >= 80) return "text-[color:var(--critical)]";
  if (r >= 60) return "text-[color:var(--high)]";
  if (r >= 30) return "text-[color:var(--warning)]";
  return "text-[color:var(--success)]";
}

function IdentityCenter() {
  const { identities } = useIdentities();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Identity Center"
        description="User risk, sign-ins, MFA posture, and conditional access across the tenant."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total identities", "12,481"],
          ["Risky users (24h)", "38", "text-[color:var(--critical)]"],
          ["MFA coverage", "97.4%", "text-[color:var(--success)]"],
          ["Impossible travel", "6", "text-[color:var(--high)]"],
        ].map(([l, v, tone]) => (
          <Panel key={l as string}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ?? ""}`}>{v}</div>
          </Panel>
        ))}
      </div>

      <div className="mt-6 mb-3 flex items-center gap-2">
        {["All users", "Risky", "Service accounts", "Executives"].map((t, i) => (
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
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Department</th>
                <th className="px-4 py-2.5 text-left">Role</th>
                <th className="px-4 py-2.5 text-left">Risk</th>
                <th className="px-4 py-2.5 text-left">MFA</th>
                <th className="px-4 py-2.5 text-left">Last sign-in</th>
                <th className="px-4 py-2.5 text-left">Location</th>
                <th className="px-4 py-2.5 text-left">Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {identities.map((u) => (
                <tr key={u.upn} className="hover:bg-background/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <IconTile
                        tone="info"
                        size="sm"
                        shape="circle"
                        className="text-[10px] font-semibold"
                      >
                        {u.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </IconTile>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="font-mono text-[10.5px] text-muted-foreground">{u.upn}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{u.dept}</td>
                  <td className="px-4 py-3 text-secondary">{u.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold tabular-nums ${riskTone(u.risk)}`}>
                        {u.risk}
                      </span>
                      <div className="h-1 w-16 overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-current"
                          style={{ width: `${u.risk}%`, color: "var(--info)" }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-secondary">
                      <ShieldCheck className="size-3.5 text-[color:var(--success)]" /> {u.mfa}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.lastSignin}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-secondary">
                      <MapPin className="size-3 text-muted-foreground" /> {u.location}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.flags.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      ) : (
                        u.flags.map((f) => (
                          <span
                            key={f}
                            className="rounded border border-[color:var(--high)]/30 bg-[color:var(--high)]/10 px-1.5 py-0.5 text-[10.5px] text-[color:var(--high)]"
                          >
                            {f}
                          </span>
                        ))
                      )}
                    </div>
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
