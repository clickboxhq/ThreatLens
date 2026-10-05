import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote } from "lucide-react";
import { Panel, StatCard } from "@/components/soc/primitives";
import { AdminPage } from "@/components/soc/admin/admin-page";

export const Route = createFileRoute("/app/admin/revenue")({
  component: AdminRevenue,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Revenue" }] }),
});

const METRICS = [
  "Monthly revenue",
  "Annual revenue",
  "Total revenue",
  "Individual revenue",
  "Organization revenue",
  "Successful payments",
  "Failed payments",
  "Refunds",
];

function AdminRevenue() {
  return (
    <AdminPage
      title="Revenue"
      description="The platform's financial view — successful payments, refunds, and revenue by customer type."
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {METRICS.map((label) => (
          <StatCard key={label} label={label} value="—" delta="No payment data available" />
        ))}
      </div>

      <Panel className="mt-4">
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground">
            <Banknote className="size-4" />
          </div>
          <h2 className="text-[15px] font-medium">No payment data available</h2>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Revenue is computed only from real, webhook-confirmed payments — never from a plan's
            list price or an active-subscription count. ThreatLens has no payment provider connected
            yet, so there is nothing to report. This page fills in automatically once Paystack
            billing is live.
          </p>
          <p className="text-[12px] text-muted-foreground">
            Registered users and organizations are on the{" "}
            <Link to="/app/admin" className="text-[color:var(--info)] underline underline-offset-2">
              Overview
            </Link>
            .
          </p>
        </div>
      </Panel>
    </AdminPage>
  );
}
