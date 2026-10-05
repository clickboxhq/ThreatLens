import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { Panel, StatCard } from "@/components/soc/primitives";
import { AdminPage } from "@/components/soc/admin/admin-page";

export const Route = createFileRoute("/app/admin/subscriptions")({
  component: AdminSubscriptions,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Subscriptions" }] }),
});

// No payment provider is integrated yet, so there are no subscriptions to show. This page
// states that plainly rather than rendering zeros as if they were real — the same honesty
// rule the rest of the admin surface holds to. The layout is the one this section will use
// once billing (Paystack) is connected: active / trial / monthly / annual / cancelled /
// failed-payment tiles, then a per-customer subscription table.
const METRICS = [
  "Active subscriptions",
  "Trial users",
  "Monthly subscribers",
  "Annual subscribers",
  "Cancelled subscriptions",
  "Failed payments",
];

function AdminSubscriptions() {
  return (
    <AdminPage
      title="Subscriptions"
      description="Subscription status across individual and organization billing customers."
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {METRICS.map((label) => (
          <StatCard key={label} label={label} value="—" />
        ))}
      </div>

      <Panel className="mt-4">
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground">
            <CreditCard className="size-4" />
          </div>
          <h2 className="text-[15px] font-medium">No subscription data yet</h2>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
            ThreatLens has no payment provider connected. Once Paystack billing is live, this page
            shows active, trial, monthly and annual subscribers, cancellations and failed payments,
            with a per-customer breakdown — plan, billing interval, start date, renewal date and
            status. Sensitive payment details are never shown here.
          </p>
          <p className="text-[12px] text-muted-foreground">
            New Nigeria-first pricing is already published on the marketing site (₦10,000/month
            individual · ₦15,000/user/month organization).
          </p>
        </div>
      </Panel>
    </AdminPage>
  );
}
