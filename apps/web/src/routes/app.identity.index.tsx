import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { SessionPicker } from "@/components/soc/session-picker";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useActiveSession } from "@/hooks/use-active-session";
import { useIdentities, useIdentitySignIns } from "@/hooks/use-identities";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ExternalLink, MapPin, ShieldCheck, ShieldOff } from "lucide-react";
import type { IdentityRiskLevel } from "@/types/socverse-operations";

export const Route = createFileRoute("/app/identity/")({
  component: IdentityCenter,
  head: () => ({ meta: [{ title: "ThreatLens · Identity Center" }] }),
});

function riskTone(level: IdentityRiskLevel) {
  if (level === "high") return "text-[color:var(--critical)]";
  if (level === "medium") return "text-[color:var(--high)]";
  if (level === "low") return "text-[color:var(--warning)]";
  return "text-[color:var(--success)]";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

function IdentityCenter() {
  const {
    isLoading: sessionsLoading,
    activeSessions,
    selectedSessionId,
    setSelectedSessionId,
  } = useActiveSession();
  const identitiesQuery = useIdentities(selectedSessionId);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>();
  // The side panel is a preview capped at a dozen sign-ins; with a month of history behind
  // each account that hides most of it, and it has never shown the directory audit trail at
  // all. Selecting a row opens the full record instead.
  const signInsQuery = useIdentitySignIns(selectedSessionId, selectedIdentityId);

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Identity Center" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedSessionId) {
    return <NoActiveSession title="Identity Center" />;
  }

  const identities = identitiesQuery.data ?? [];
  const selected = identities.find((i) => i.id === selectedIdentityId);
  // Same alert-derived risk as Device Center — see apps/api's entity-risk.ts.
  const totalRisky = identities.filter((i) => i.riskLevel !== "none").length;
  const mfaOff = identities.filter((i) => i.mfaStatus === "not_registered").length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Identity Center"
        description="User risk, sign-ins, and MFA posture within this investigation."
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Identities
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{identities.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            High risk
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--critical)]">
            {totalRisky}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            MFA not registered
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--high)]">
            {mfaOff}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Privileged
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {identities.filter((i) => i.isPrivileged).length}
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel padded={false}>
          {identitiesQuery.isPending ? (
            <div className="flex flex-col gap-px p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : identities.length === 0 ? (
            <EmptyState
              title="No identities"
              description="This session has no generated identities."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">User</th>
                    <th className="px-4 py-2.5 text-left">Department</th>
                    <th className="px-4 py-2.5 text-left">Risk</th>
                    <th className="px-4 py-2.5 text-left">MFA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {identities.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedIdentityId(u.id)}
                      className={`cursor-pointer hover:bg-background/40 ${u.id === selectedIdentityId ? "bg-background/60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <IconTile
                            tone="info"
                            size="sm"
                            shape="circle"
                            className="text-[10px] font-semibold"
                          >
                            {initials(u.displayName)}
                          </IconTile>
                          <div>
                            <div className="font-medium">{u.displayName}</div>
                            <div className="font-mono text-[10.5px] text-muted-foreground">
                              {u.userPrincipalName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-secondary">{u.department}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold capitalize ${riskTone(u.riskLevel)}`}>
                          {u.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-secondary">
                          {u.mfaStatus === "enforced" ? (
                            <ShieldCheck className="size-3.5 text-[color:var(--success)]" />
                          ) : (
                            <ShieldOff className="size-3.5 text-[color:var(--warning)]" />
                          )}
                          {u.mfaStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title={selected ? selected.displayName : "Sign-in history"}
          actions={
            selected && selectedSessionId ? (
              <Link
                to="/app/identity/$sessionId/$identityId"
                params={{ sessionId: selectedSessionId, identityId: selected.id }}
                className="inline-flex items-center gap-1 text-[11.5px] text-[color:var(--info)] hover:underline"
              >
                Full workspace <ExternalLink className="size-3" />
              </Link>
            ) : undefined
          }
        >
          {!selected ? (
            <p className="text-[12px] text-secondary">
              Select a user to open their full record — sign-in history, directory audit trail and
              cloud activity.
            </p>
          ) : signInsQuery.isPending ? (
            <Skeleton className="h-40" />
          ) : (signInsQuery.data ?? []).length === 0 ? (
            <p className="text-[12px] text-secondary">No sign-in activity recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {(signInsQuery.data ?? []).slice(0, 12).map((s) => (
                <li key={s.id} className="text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.application}</span>
                    <span
                      className={
                        s.result === "success"
                          ? "text-[color:var(--success)]"
                          : "text-[color:var(--critical)]"
                      }
                    >
                      {s.result.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" /> {s.sourceCity}, {s.sourceCountry}
                    <span>· {formatRelativeTime(s.occurredAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
