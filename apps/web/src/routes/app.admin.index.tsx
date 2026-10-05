import { createFileRoute } from "@tanstack/react-router";
import { Users, Building2, CreditCard, ShieldCheck, Activity, Gauge } from "lucide-react";
import { Panel, StatCard } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { useAdminOverview } from "@/hooks/use-admin";
import { num, pct, moneyCents, relTime } from "@/lib/admin-format";

export const Route = createFileRoute("/app/admin/")({
  component: Overview,
  head: () => ({ meta: [{ title: "ThreatLens · Platform Admin" }] }),
});

function Overview() {
  const { data, isPending, isError } = useAdminOverview();

  return (
    <AdminPage title="Overview" description="Operational state of the ThreatLens platform.">
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          title="Couldn't load the dashboard"
          description="This page is restricted to platform administrators."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Registered Users"
              value={num(data.users.total)}
              delta={`${num(data.users.newPast30Days)} in the last 30 days`}
              icon={<Users className="size-4" />}
            />
            <StatCard
              label="Active Users"
              value={num(data.users.active)}
              delta="Signed in within 30 days"
              icon={<Activity className="size-4" />}
            />
            <StatCard
              label="New Users · Today"
              value={num(data.users.newToday)}
              delta={`${num(data.users.newPast7Days)} this week`}
            />
            <StatCard
              label="Total Organizations"
              value={num(data.organizations.total)}
              icon={<Building2 className="size-4" />}
            />
            <StatCard
              label="Active Organizations"
              value={num(data.organizations.active)}
              delta="Not suspended"
            />
            <StatCard
              label="Active Subscriptions"
              value={num(data.subscriptions.active)}
              delta={data.subscriptions.active === null ? "No billing connected" : undefined}
              icon={<ShieldCheck className="size-4" />}
            />
            <StatCard
              label="Monthly Revenue"
              value={
                data.revenue.available
                  ? moneyCents(data.revenue.netRevenueThisMonthCents, data.revenue.currency)
                  : "—"
              }
              delta={data.revenue.available ? undefined : "No payment data available"}
              icon={<CreditCard className="size-4" />}
            />
            <StatCard
              label="Total Revenue"
              value={
                data.revenue.available
                  ? moneyCents(data.revenue.netRevenueCents, data.revenue.currency)
                  : "—"
              }
              delta={data.revenue.available ? undefined : "No payment data available"}
            />
            <StatCard
              label="Investigation Submissions"
              value={num(data.investigations.submissions)}
              delta="Submitted for scoring"
              icon={<Gauge className="size-4" />}
            />
            <StatCard
              label="Average Platform Score"
              value={pct(data.investigations.averageScorePercent)}
              delta="Across all scored investigations"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Users by role">
              <ul className="space-y-2 text-[12.5px]">
                {(
                  [
                    ["Students", data.users.byRole.student],
                    ["Instructors", data.users.byRole.instructor],
                    ["Organization admins", data.users.byRole.org_admin],
                    ["Platform admins", data.users.byRole.platform_admin],
                  ] as const
                ).map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between">
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{num(count)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Revenue">
              {data.revenue.available ? (
                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <Metric
                    label="This month"
                    value={moneyCents(data.revenue.netRevenueThisMonthCents, data.revenue.currency)}
                  />
                  <Metric
                    label="This year"
                    value={moneyCents(data.revenue.netRevenueThisYearCents, data.revenue.currency)}
                  />
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-[13px] font-medium">No payment data available</p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
                    ThreatLens has no payment provider connected yet. Revenue and subscription
                    figures report here once billing is live — nothing on this page is estimated.
                  </p>
                </div>
              )}
            </Panel>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Updated {relTime(data.generatedAt)}
          </p>
        </>
      )}
    </AdminPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[16px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}
