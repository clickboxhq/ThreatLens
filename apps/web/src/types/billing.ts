export type BillingPlanId = "individual" | "organization";
export type BillingIntervalId = "monthly" | "annual";

/** What the API says this account is entitled to right now. */
export interface EntitlementDto {
  /** The only field that decides access. Everything else is for display. */
  active: boolean;
  planId: string | null;
  interval: string | null;
  /** trialing | active | past_due | cancelled | expired */
  status: string | null;
  currentPeriodEnd: string | null;
  /** Covered by an organisation's subscription rather than a personal one. */
  viaOrganization: boolean;
}

/** What must be shown before someone enters a card for a trial. */
export interface CheckoutTrialTerms {
  days: number;
  /** The token amount charged to capture the card, in kobo. Refunded immediately. */
  verificationKobo: number;
  firstChargeKobo: number;
  firstChargeAt: string;
}

export interface CheckoutSessionDto {
  authorizationUrl: string;
  reference: string;
  /** True on a Paystack test key — surfaced so nobody mistakes a sandbox for a real charge. */
  testMode: boolean;
  trial: CheckoutTrialTerms | null;
}

export interface CancellationDto {
  status: string;
  /** Access continues to this date; cancelling never ends it early. */
  accessUntil: string;
}
