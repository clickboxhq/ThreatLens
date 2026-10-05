// The billing seam's public shapes. ThreatLens has no payment provider yet (§1.7 puts paid
// tiers in Phase 1+, and infra/RAILWAY.md's deploy has no Stripe/Paddle/webhook wiring), so
// today every one of these comes back empty. They exist now so the platform-admin analytics
// endpoint has a stable contract to build against, and so wiring a real provider later is
// "fill in BillingService", not "reshape every caller".

export type BillingCustomerType = 'individual' | 'organization';

// What a real provider integration must eventually produce, per billing customer. Revenue is
// NET and CONFIRMED: successful captured payments only, minus refunds and reversals, after
// de-duplicating repeated webhook deliveries. Never derived from a plan's list price or from
// an active-subscription count — only from money that actually settled.
export interface CustomerRevenue {
  // Minor units (cents) to avoid float drift, same discipline a real ledger uses.
  netRevenueCents: number;
  currency: string;
  plan: string | null;
  subscriptionStatus: string | null;
  lastPaymentAt: string | null;
}

export interface PlatformRevenueSummary {
  // False until a provider is connected. The frontend renders "No payment data available"
  // rather than a fabricated figure.
  available: boolean;
  reason: string | null;
  currency: string;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  netRevenueThisMonthCents: number;
  netRevenueThisYearCents: number;
  payingCustomerCount: number;
}
