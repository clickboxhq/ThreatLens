import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { AdminTable, type Column } from "@/components/soc/admin/admin-table";
import { useUserAnalytics, useProductAnalytics, useOrgAnalytics } from "@/hooks/use-admin";
import { usePlatformCustomers } from "@/hooks/use-admin-analytics";
import { num, pct, moneyCents } from "@/lib/admin-format";
import type { MonthlyPoint } from "@/types/admin";

export const Route = createFileRoute("/app/admin/analytics")({
  component: PlatformAnalytics,
  head: () => ({ meta: [{ title: "ThreatLens · Platform Analytics" }] }),
});

function MiniBars({
  points,
  valueKey,
}: {
  points: MonthlyPoint[];
  valueKey: "count" | "cumulative";
}) {
  const max = Math.max(1, ...points.map((p) => p[valueKey]));
  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((p) => (
        <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-[color:var(--info)]/70"
            style={{ height: `${(p[valueKey] / max) * 100}%`, minHeight: 2 }}
            title={`${p.label}: ${p[valueKey]}`}
          />
          <span className="text-[9px] text-muted-foreground">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[18px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function UserAnalyticsSection() {
  const { data, isPending, isError } = useUserAnalytics();
  return (
    <Panel title="User analytics">
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError || !data ? (
        <EmptyState title="Unavailable" description="Restricted to platform administrators." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KV label="Total users" value={num(data.totalUsers)} />
            <KV label="Active users" value={num(data.activeUsers)} />
            <KV label="New this month" value={num(data.newThisMonth)} />
          </div>
          <div className="mt-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Registrations · last 12 months
            </div>
            <MiniBars points={data.growth} valueKey="count" />
          </div>
        </>
      )}
    </Panel>
  );
}

function OrgAnalyticsSection() {
  const { data, isPending, isError } = useOrgAnalytics();
  return (
    <Panel title="Organization analytics">
      {isPending ? (
        <Skeleton className="h-40" />
      ) : isError || !data ? (
        <EmptyState title="Unavailable" description="Restricted to platform administrators." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KV label="Organizations" value={num(data.totalOrganizations)} />
            <KV label="Active" value={num(data.activeOrganizations)} />
            <KV
              label="Avg members / org"
              value={
                data.averageMembersPerOrganization === null
                  ? "—"
                  : String(data.averageMembersPerOrganization)
              }
            />
          </div>
          <div className="mt-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organization growth · cumulative
            </div>
            <MiniBars points={data.growth} valueKey="cumulative" />
          </div>
        </>
      )}
    </Panel>
  );
}

function ProductAnalyticsSection() {
  const { data, isPending, isError } = useProductAnalytics();
  return (
    <Panel title="Product analytics" padded={false}>
      {isPending ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : isError || !data ? (
        <EmptyState title="Unavailable" description="Restricted to platform administrators." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <KV label="Scenarios launched" value={num(data.scenariosLaunched)} />
            <KV label="Investigations completed" value={num(data.investigationsCompleted)} />
            <KV label="Completion rate" value={pct(data.completionRatePercent)} />
            <KV label="Average score" value={pct(data.averageScorePercent)} />
          </div>
          <div className="border-t border-border px-4 py-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Most popular scenarios
            </div>
            <ul className="space-y-1.5 text-[12.5px]">
              {data.mostPopularScenarios.map((s) => (
                <li key={s.scenarioId} className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.title}</span>
                  <span className="shrink-0 tabular-nums text-secondary">
                    {num(s.launches)} launches
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Panel>
  );
}

function RevenueByCustomer() {
  const {
    customers,
    isPending,
    isError,
    isFetching,
    page,
    setPage,
    search,
    setSearch,
    type,
    setType,
    pageSize,
  } = usePlatformCustomers();

  const totalPages = customers ? Math.max(1, Math.ceil(customers.total / pageSize)) : 1;

  type Row = NonNullable<typeof customers>["data"][number];
  const columns: Column<Row>[] = [
    { key: "name", header: "Customer", cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="capitalize text-secondary">{r.type}</span>,
    },
    {
      key: "members",
      header: "Members",
      align: "right",
      cell: (r) => r.memberCount ?? "—",
    },
    { key: "plan", header: "Plan", cell: (r) => r.plan ?? "—" },
    { key: "status", header: "Status", cell: (r) => r.subscriptionStatus ?? "—" },
    {
      key: "revenue",
      header: "Total Revenue",
      align: "right",
      cell: (r) =>
        customers?.revenueAvailable ? moneyCents(r.totalRevenueCents, r.currency) : "—",
    },
  ];

  return (
    <AdminTable
      title="Revenue by customer"
      columns={columns}
      rows={customers?.data ?? []}
      rowKey={(r) => `${r.type}-${r.customerId}`}
      state={
        isPending
          ? "loading"
          : isError
            ? "error"
            : !customers || customers.data.length === 0
              ? "empty"
              : "ready"
      }
      emptyMessage={search ? "Try a different search." : "No registered customers yet."}
      search={{ value: search, onChange: setSearch, placeholder: "Search by name or email" }}
      filters={[
        {
          key: "type",
          value: type ?? "all",
          onChange: (v) => setType(v === "all" ? undefined : (v as "individual" | "organization")),
          options: [
            { value: "all", label: "All customers" },
            { value: "organization", label: "Organizations" },
            { value: "individual", label: "Individuals" },
          ],
        },
      ]}
      page={page}
      totalPages={totalPages}
      total={customers?.total ?? 0}
      onPage={setPage}
      busy={isFetching}
    />
  );
}

function PlatformAnalytics() {
  return (
    <AdminPage
      title="Platform Analytics"
      description="Users, product usage, organizations, and revenue — from real application data."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UserAnalyticsSection />
        <OrgAnalyticsSection />
      </div>
      <div className="mt-4">
        <ProductAnalyticsSection />
      </div>
      <div className="mt-4">
        <RevenueByCustomer />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Revenue analytics report real figures only once a payment provider is connected — nothing on
        this tab is estimated or projected.
      </p>
    </AdminPage>
  );
}
