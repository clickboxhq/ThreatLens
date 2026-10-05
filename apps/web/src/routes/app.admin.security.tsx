import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, StatCard } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { AdminTable, type Column } from "@/components/soc/admin/admin-table";
import { useSecurityOverview, useSecurityEvents } from "@/hooks/use-admin";
import { num, pct, relTime, humaniseAction } from "@/lib/admin-format";
import type { SecurityEvent } from "@/types/admin";

export const Route = createFileRoute("/app/admin/security")({
  component: AdminSecurity,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Security Events" }] }),
});

const PAGE_SIZE = 25;

function AdminSecurity() {
  const overview = useSecurityOverview();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const events = useSecurityEvents({ page, action: action || undefined });

  const columns: Column<SecurityEvent>[] = [
    { key: "event", header: "Event", cell: (e) => humaniseAction(e.action) },
    {
      key: "actor",
      header: "Account",
      cell: (e) =>
        e.actor ? (
          <span className="font-mono text-[11.5px]">{e.actor.email}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "ip",
      header: "IP",
      cell: (e) => <span className="font-mono text-[11px]">{e.actorIp ?? "—"}</span>,
    },
    { key: "when", header: "When", cell: (e) => relTime(e.occurredAt) },
  ];

  const o = overview.data;

  return (
    <AdminPage
      title="Security Events"
      description="Authentication-surface events and privileged admin actions."
    >
      {overview.isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      ) : overview.isError || !o ? (
        <EmptyState title="Unavailable" description="Restricted to platform administrators." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="MFA adoption"
              value={pct(o.mfa.adoptionPercent)}
              delta={`${num(o.mfa.enabled)} enabled · ${num(o.mfa.disabled)} without`}
            />
            <StatCard
              label="Privileged accounts without MFA"
              value={num(o.mfa.privilegedWithoutMfa)}
              tone={o.mfa.privilegedWithoutMfa > 0 ? "critical" : "default"}
            />
            <StatCard
              label="Failed logins · 24h"
              value={num(o.failedLogins.last24h)}
              delta={`${num(o.failedLogins.last7d)} in 7 days`}
            />
            <StatCard
              label="Account lockouts · 7d"
              value={num(o.lockouts.last7d)}
              delta={`${num(o.failedMfaChallenges.last7d)} failed MFA challenges`}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="MFA" className="lg:col-span-1">
              <ul className="space-y-2 text-[12.5px]">
                <li className="flex justify-between">
                  <span className="text-secondary">Users with MFA</span>
                  <span className="tabular-nums">{num(o.mfa.enabled)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-secondary">Users without MFA</span>
                  <span className="tabular-nums">{num(o.mfa.disabled)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-secondary">Privileged, no MFA</span>
                  <span className="tabular-nums">{num(o.mfa.privilegedWithoutMfa)}</span>
                </li>
              </ul>
            </Panel>

            <div className="lg:col-span-2">
              <AdminTable
                title="Security events"
                columns={columns}
                rows={events.data?.data ?? []}
                rowKey={(e) => e.id}
                state={
                  events.isPending
                    ? "loading"
                    : events.isError
                      ? "error"
                      : (events.data?.data.length ?? 0) === 0
                        ? "empty"
                        : "ready"
                }
                filters={[
                  {
                    key: "action",
                    value: action,
                    onChange: (v) => {
                      setAction(v);
                      setPage(1);
                    },
                    options: [
                      { value: "", label: "All security events" },
                      { value: "login_failed", label: "Failed logins" },
                      { value: "account_locked", label: "Account lockouts" },
                      { value: "mfa_challenge_failed", label: "Failed MFA" },
                      { value: "mfa_enabled", label: "MFA enabled" },
                      { value: "mfa_disabled", label: "MFA disabled" },
                      { value: "admin.user_mfa_reset", label: "MFA reset by admin" },
                      { value: "admin.user_suspended", label: "Account suspended" },
                    ],
                  },
                ]}
                page={page}
                totalPages={events.data ? Math.max(1, Math.ceil(events.data.total / PAGE_SIZE)) : 1}
                total={events.data?.total ?? 0}
                onPage={setPage}
                busy={events.isFetching}
              />
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}
