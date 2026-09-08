import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Search, Users } from "lucide-react";
import { Panel, SectionHeader, StatCard } from "@/components/soc/primitives";
import { EmptyState, Skeleton } from "@/components/soc/ui/skeleton";
import { useAuthUser } from "@/lib/auth-store";
import { usePlatformCustomers, usePlatformOverview } from "@/hooks/use-admin-analytics";

export const Route = createFileRoute("/app/admin")({
  component: PlatformAnalytics,
  head: () => ({
    meta: [
      { title: "ThreatLens · Platform Analytics" },
      {
        name: "description",
        content: "Platform-wide analytics — registered users, organizations, and revenue.",
      },
    ],
  }),
});

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function CustomerTable() {
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
    sort,
    setSort,
    pageSize,
  } = usePlatformCustomers();
  const [searchInput, setSearchInput] = useState("");

  const totalPages = customers ? Math.max(1, Math.ceil(customers.total / pageSize)) : 1;

  return (
    <Panel
      title="Revenue by Customer"
      actions={
        <div className="flex items-center gap-2">
          <select
            value={type ?? "all"}
            onChange={(e) =>
              setType(
                e.target.value === "all"
                  ? undefined
                  : (e.target.value as "individual" | "organization"),
              )
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none"
          >
            <option value="all">All customers</option>
            <option value="organization">Organizations</option>
            <option value="individual">Individuals</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest" | "name")}
            className="h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
        </div>
      }
      padded={false}
    >
      <form
        className="flex items-center gap-2 border-b border-border px-4 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email"
          className="h-8 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
        />
        {search && (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchInput("");
              setSearch("");
            }}
          >
            Clear
          </button>
        )}
      </form>

      {isPending ? (
        <div className="flex flex-col gap-px p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load customers"
          description="This data is restricted to platform administrators."
        />
      ) : !customers || customers.data.length === 0 ? (
        <EmptyState
          title="No customers match"
          description={search ? "Try a different search." : "No registered customers yet."}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Customer</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Members</th>
                  <th className="px-4 py-2.5 font-medium">Plan</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.data.map((row) => (
                  <tr key={`${row.type}-${row.customerId}`} className="hover:bg-background/40">
                    <td className="px-4 py-2.5 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-secondary">
                        {row.type === "organization" ? (
                          <Building2 className="size-3.5" />
                        ) : (
                          <Users className="size-3.5" />
                        )}
                        {row.type === "organization" ? "Organization" : "Individual"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-secondary">
                      {row.memberCount ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.plan ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {row.subscriptionStatus ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {customers.revenueAvailable ? (
                        formatMoney(row.totalRevenueCents, row.currency)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
            <span>
              {customers.total.toLocaleString()} customer
              {customers.total === 1 ? "" : "s"}
              {isFetching && " · updating…"}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-app-ghost"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                className="btn-app-ghost"
                disabled={!customers.hasMore}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function PlatformAnalytics() {
  const user = useAuthUser();
  const { overview, isPending, isError } = usePlatformOverview();

  if (user && user.role !== "platform_admin") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Platform Analytics" />
        <EmptyState
          title="Restricted"
          description="Platform analytics are available to platform administrators only."
        />
      </div>
    );
  }

  const revenue = overview?.revenue;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Platform Analytics"
        description="How ThreatLens is growing as a business — registered users, organizations, and revenue."
      />

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load analytics"
          description="This page is restricted to platform administrators."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              label="Total Registered Users"
              value={overview!.users.total.toLocaleString()}
              delta={`${overview!.users.newPast30Days.toLocaleString()} in the last 30 days`}
              icon={<Users className="size-4" />}
            />
            <StatCard
              label="Registered Organizations"
              value={overview!.organizations.total.toLocaleString()}
              icon={<Building2 className="size-4" />}
            />
            <StatCard
              label="Total Revenue"
              value={
                revenue?.available ? formatMoney(revenue.netRevenueCents, revenue.currency) : "—"
              }
              delta={revenue?.available ? undefined : "No payment data available"}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Users by role" className="lg:col-span-1">
              <ul className="space-y-2 text-[12.5px]">
                {(
                  [
                    ["Students", overview!.users.byRole.student],
                    ["Instructors", overview!.users.byRole.instructor],
                    ["Org admins", overview!.users.byRole.org_admin],
                    ["Platform admins", overview!.users.byRole.platform_admin],
                  ] as const
                ).map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between">
                    <span className="text-secondary">{label}</span>
                    <span className="tabular-nums">{count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-border pt-2 text-[11.5px] text-muted-foreground">
                New today: {overview!.users.newToday.toLocaleString()} · last 7 days:{" "}
                {overview!.users.newPast7Days.toLocaleString()}
              </div>
            </Panel>

            <Panel title="Revenue overview" className="lg:col-span-2">
              {revenue?.available ? (
                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      This month
                    </div>
                    <div className="mt-0.5 text-[16px] font-semibold tabular-nums">
                      {formatMoney(revenue.netRevenueThisMonthCents, revenue.currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      This year
                    </div>
                    <div className="mt-0.5 text-[16px] font-semibold tabular-nums">
                      {formatMoney(revenue.netRevenueThisYearCents, revenue.currency)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[13px] font-medium text-foreground">
                    No payment data available
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
                    ThreatLens has no payment provider connected yet. Once billing is live,
                    confirmed revenue will report here and in the customer table below — nothing on
                    this page is estimated or projected.
                  </p>
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <CustomerTable />
          </div>
        </>
      )}
    </div>
  );
}
