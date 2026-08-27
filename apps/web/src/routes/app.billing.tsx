import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useBilling } from "@/hooks/use-billing";
import type { SubscriptionStatus } from "@/types/billing";

const statusBanner: Partial<Record<SubscriptionStatus, { tone: string; message: string }>> = {
  trial: {
    tone: "info",
    message: "You're on a trial plan. Add a payment method before it ends to avoid interruption.",
  },
  past_due: {
    tone: "critical",
    message: "Your last payment failed. Update your payment method to avoid service interruption.",
  },
  cancelled: {
    tone: "high",
    message: "Your subscription is cancelled and will not renew at the end of the current period.",
  },
  expired: {
    tone: "critical",
    message: "Your subscription has expired. Renew to restore access for your organization.",
  },
};

export const Route = createFileRoute("/app/billing")({
  component: Billing,
  head: () => ({
    meta: [
      { title: "ThreatLens · Billing" },
      {
        name: "description",
        content: "Seat allocation, scenario usage, and invoices for your ThreatLens tenant.",
      },
      { property: "og:title", content: "ThreatLens · Billing" },
      {
        property: "og:description",
        content: "Seats, usage, and invoices for the ThreatLens platform.",
      },
    ],
  }),
});

function Billing() {
  const { summary, invoices, seatUtilization, state } = useBilling();
  const banner = summary ? statusBanner[summary.subscriptionStatus] : undefined;
  return (
    <WorkspacePage
      title="Billing"
      description="Enterprise plan — billed per active analyst seat with unlimited scenario launches."
      state={state}
      banner={
        banner && (
          <div
            className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px]"
            style={{
              borderColor: `color-mix(in oklab, var(--${banner.tone}) 35%, var(--border))`,
              background: `color-mix(in oklab, var(--${banner.tone}) 8%, var(--card))`,
              color: `var(--${banner.tone})`,
            }}
          >
            <AlertTriangle className="size-4 shrink-0" />
            {banner.message}
          </div>
        )
      }
      stats={[
        {
          label: "Plan",
          value: summary?.plan ?? "—",
          delta: summary ? `${summary.billingCycle} · ${summary.paymentMethod}` : undefined,
        },
        {
          label: "Active seats",
          value: summary ? String(summary.activeSeats) : "—",
          delta: summary ? `of ${summary.licensedSeats} licensed` : undefined,
        },
        {
          label: "Scenario launches",
          value: summary ? summary.scenarioLaunches.toLocaleString() : "—",
          delta: "this month",
          tone: "info",
        },
        {
          label: "Next invoice",
          value: summary?.nextInvoiceAmount ?? "—",
          delta: summary ? `due ${summary.nextInvoiceDue}` : undefined,
          tone: "high",
        },
      ]}
      table={{
        title: "Invoices",
        columns: ["Invoice", "Period", "Seats", "Amount", "Status"],
        rows: invoices.map((i) => [
          <span className="font-mono text-[11px] text-muted-foreground">{i.id}</span>,
          i.period,
          <span className="tabular-nums">{i.seats}</span>,
          <span className="tabular-nums">{i.amount}</span>,
          <span
            className="text-[11px] font-medium"
            style={{ color: i.status === "Paid" ? "var(--success)" : "var(--warning)" }}
          >
            {i.status}
          </span>,
        ]),
      }}
      asides={[{ title: "Seat utilization", items: seatUtilization }]}
    />
  );
}
