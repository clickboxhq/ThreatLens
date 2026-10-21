/**
 * The server's copy of the published prices.
 *
 * `apps/web/src/lib/pricing.ts` is the source of truth for what the marketing site *says*;
 * this is what the API will actually charge. They are deliberately separate files — the API
 * cannot import from the web workspace, and more importantly a price the server charges must
 * never be settable by anything the browser sends. The checkout endpoint takes a plan id and
 * an interval, never an amount.
 *
 * Keep the two in step. The amounts here are the ones in lib/pricing.ts, in kobo, which is
 * the unit Paystack transacts in: 1 NGN = 100 kobo.
 */

export type PlanId = 'individual' | 'organization';
export type BillingInterval = 'monthly' | 'annual';

export interface PlanPrice {
  amountKobo: number;
  /**
   * Filled per environment once the plan exists in the Paystack dashboard. Null keeps the
   * monthly plan from recurring — the charge still works, it simply will not renew — so an
   * unfinished setup degrades to a one-off rather than silently charging the wrong thing.
   */
  paystackPlanCode: string | null;
}

const code = (envKey: string): string | null => process.env[envKey] ?? null;

export const PLAN_PRICES: Record<PlanId, Record<BillingInterval, PlanPrice>> = {
  individual: {
    monthly: {
      amountKobo: 10_000 * 100,
      paystackPlanCode: code('PAYSTACK_PLAN_INDIVIDUAL_MONTHLY'),
    },
    annual: {
      amountKobo: 100_000 * 100,
      paystackPlanCode: null,
    },
  },
  organization: {
    monthly: {
      amountKobo: 15_000 * 100,
      paystackPlanCode: code('PAYSTACK_PLAN_ORGANIZATION_MONTHLY'),
    },
    annual: {
      amountKobo: 150_000 * 100,
      paystackPlanCode: null,
    },
  },
};
