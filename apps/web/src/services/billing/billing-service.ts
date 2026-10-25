import type {
  BillingIntervalId,
  BillingPlanId,
  CancellationDto,
  CheckoutSessionDto,
  EntitlementDto,
} from "@/types/billing";

export interface BillingService {
  /** What this account is entitled to. Safe to call for anyone signed in. */
  mine(): Promise<EntitlementDto>;
  /**
   * Starts a payment and returns where to send the browser. Nothing is recorded until
   * Paystack's signed webhook arrives, so abandoning the page leaves no subscription behind.
   */
  startCheckout(input: {
    planId: BillingPlanId;
    interval: BillingIntervalId;
    orgId?: string;
    trial?: boolean;
  }): Promise<CheckoutSessionDto>;
  /** Stops the next charge. Access runs to the end of the period already paid for. */
  cancel(): Promise<CancellationDto>;
}
