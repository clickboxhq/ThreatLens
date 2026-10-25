import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { useBillingActions, useEntitlement } from "@/hooks/use-billing";
import { formatNgn, PLANS } from "@/lib/pricing";
import { ApiError } from "@/lib/api-client";
import type { EntitlementDto } from "@/types/billing";

export const Route = createFileRoute("/app/billing")({
  // Paystack sends people back here with ?reference=. It is a hint to wait, not proof of
  // payment — only the signed webhook grants access.
  // Return type annotated so the key is optional: without it every navigate() to this
  // route would have to pass reference explicitly.
  validateSearch: (search: Record<string, unknown>): { reference?: string } => ({
    reference: typeof search.reference === "string" ? search.reference : undefined,
  }),
  component: Billing,
  head: () => ({
    meta: [
      { title: "ThreatLens · Billing" },
      {
        name: "description",
        content: "Your ThreatLens plan, renewal date, and payment settings.",
      },
      { property: "og:title", content: "ThreatLens · Billing" },
      {
        property: "og:description",
        content: "Your ThreatLens plan, renewal date, and payment settings.",
      },
    ],
  }),
});

const DATE = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const individual = PLANS.find((p) => p.id === "individual")!;
const monthlyNgn = individual.prices!.monthly.amountNgn;

function statusLabel(e: EntitlementDto): { text: string; tone: string } {
  if (e.status === "trialing") return { text: "Free trial", tone: "var(--info)" };
  if (e.status === "past_due") return { text: "Payment failed", tone: "var(--warning)" };
  if (e.status === "cancelled") return { text: "Cancelled", tone: "var(--warning)" };
  if (e.active) return { text: "Active", tone: "var(--success)" };
  return { text: "No subscription", tone: "var(--muted-foreground)" };
}

function Billing() {
  const { reference } = Route.useSearch();
  const { entitlement, isPending } = useEntitlement(Boolean(reference));
  const { startCheckout, isStartingCheckout, cancel, isCancelling } = useBillingActions();
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function begin(trial: boolean) {
    try {
      const session = await startCheckout({
        planId: "individual",
        interval: "monthly",
        trial,
      });
      // Paystack hosts the card form; we never see card details.
      window.location.href = session.authorizationUrl;
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not start checkout. Nothing was charged.",
      );
    }
  }

  if (isPending) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Billing" description="Your plan and payment settings." />
        <div className="flex items-center gap-2 py-10 text-[13px] text-secondary">
          <Loader2 className="size-4 animate-spin" /> Loading your plan…
        </div>
      </div>
    );
  }

  const e = entitlement;
  const status = e ? statusLabel(e) : null;
  const renews = e?.currentPeriodEnd ? new Date(e.currentPeriodEnd) : null;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title="Billing" description="Your plan and payment settings." />

      {reference && !e?.active && (
        <Panel className="mb-4">
          <div className="flex items-center gap-2.5 px-5 py-4 text-[13px] text-secondary">
            <Loader2 className="size-4 animate-spin" />
            Confirming your payment with Paystack. This usually takes a few seconds — you can leave
            this page, nothing will be lost.
          </div>
        </Panel>
      )}

      {e?.viaOrganization && (
        <Panel className="mb-4">
          <div className="px-5 py-4 text-[13px] text-secondary">
            Your access is covered by your organisation's subscription. There is nothing to pay and
            nothing to cancel here — your organisation's admin manages the plan.
          </div>
        </Panel>
      )}

      {/* Not while the confirming banner is up: offering the trial to somebody who has
          just paid for it reads as though the payment failed. */}
      {!e?.active && !e?.viaOrganization && !reference && (
        <Panel>
          <div className="px-5 py-6">
            <h2 className="text-[15px] font-medium text-foreground">Start your 7-day free trial</h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Full access to every scenario, scored investigations, and certificates.
            </p>

            {/* Said plainly and before the card, not in small print after it. */}
            <div className="mt-4 rounded-md border border-border bg-background/50 p-3.5 text-[12.5px] leading-relaxed text-secondary">
              <div className="font-medium text-foreground">What happens</div>
              <ul className="mt-1.5 space-y-1">
                <li>
                  We charge a refundable ₦50 now to confirm your card — it comes straight back.
                </li>
                <li>
                  Seven days free. After that,{" "}
                  <span className="font-medium text-foreground">
                    {formatNgn(monthlyNgn)} per month
                  </span>
                  , charged automatically.
                </li>
                <li>
                  We'll email you two days before the first charge. Cancel any time before then and
                  you pay nothing.
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Button onClick={() => void begin(true)} disabled={isStartingCheckout}>
                {isStartingCheckout ? "Starting…" : "Start free trial"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void begin(false)}
                disabled={isStartingCheckout}
              >
                Skip the trial and subscribe
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {e?.active && !e.viaOrganization && (
        <Panel>
          <div className="px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-full border border-border bg-background text-muted-foreground">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <div className="text-[14px] font-medium capitalize text-foreground">
                    {e.planId ?? "Individual"} · {e.interval ?? "monthly"}
                  </div>
                  {status && (
                    <div className="text-[12px] font-medium" style={{ color: status.tone }}>
                      {status.text}
                    </div>
                  )}
                </div>
              </div>

              {e.status !== "cancelled" && (
                <Button
                  variant="ghost"
                  className="text-[13px]"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel subscription
                </Button>
              )}
            </div>

            {renews && (
              <div className="mt-4 border-t border-border pt-4 text-[13px] text-secondary">
                {e.status === "trialing" && (
                  <>
                    Your trial ends on{" "}
                    <span className="font-medium text-foreground">{DATE.format(renews)}</span>, when
                    we'll charge {formatNgn(monthlyNgn)}. Cancel before then and you pay nothing.
                  </>
                )}
                {e.status === "active" && (
                  <>
                    Renews on{" "}
                    <span className="font-medium text-foreground">{DATE.format(renews)}</span>.
                  </>
                )}
                {e.status === "cancelled" && (
                  <>
                    Cancelled. You keep full access until{" "}
                    <span className="font-medium text-foreground">{DATE.format(renews)}</span>, and
                    will not be charged again.
                  </>
                )}
                {e.status === "past_due" && (
                  <span className="inline-flex items-start gap-1.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[color:var(--warning)]" />
                    <span>
                      Your last payment did not go through. Access continues until{" "}
                      <span className="font-medium text-foreground">{DATE.format(renews)}</span>.
                      Update your card to keep it.
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      <p className="mt-4 text-[12.5px] text-muted-foreground">
        Payments are handled by Paystack. We never see or store your card details. Need an invoice
        or seats for a team?{" "}
        <Link to="/contact" className="text-[color:var(--info)] underline underline-offset-2">
          Get in touch
        </Link>
        .
      </p>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        tone="default"
        title="Cancel your subscription?"
        description={
          renews
            ? `You'll keep full access until ${DATE.format(renews)} and won't be charged again.`
            : "You will not be charged again."
        }
        confirmLabel="Cancel subscription"
        cancelLabel="Keep it"
        onConfirm={async () => {
          try {
            const result = await cancel();
            toast.success(
              `Cancelled. Access continues until ${DATE.format(new Date(result.accessUntil))}.`,
            );
          } catch (err) {
            toast.error(
              err instanceof ApiError
                ? err.message
                : "Could not cancel. Nothing has changed — please try again.",
            );
            throw err;
          }
        }}
      />
      {isCancelling && <span className="sr-only">Cancelling…</span>}
    </div>
  );
}
