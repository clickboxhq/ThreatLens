// Single source of truth for ThreatLens's public pricing — Nigeria-first, NGN.
//
// This is display + configuration only. There is no payment provider integrated yet; the
// marketing CTAs route to signup / contact. When Paystack is added, its plan setup reads
// straight from here: `amountKobo` is what a Paystack plan/transaction is created with (Paystack
// works in kobo — 1 NGN = 100 kobo), `interval` maps to Paystack's plan interval, and
// `paystackPlanCode` is filled in per environment once the plans exist in the Paystack
// dashboard. Nothing downstream should hardcode a price — import from here.

export type BillingPeriod = "monthly" | "annual";

export interface PlanPrice {
  /** Whole NGN, for display. */
  amountNgn: number;
  /** Kobo — the unit Paystack transacts in. amountNgn * 100. */
  amountKobo: number;
  interval: "monthly" | "annually";
  /** Per seat (organisations) rather than a flat plan price. */
  perUser: boolean;
  /** Filled per environment when the Paystack plan exists; null keeps checkout disabled. */
  paystackPlanCode: string | null;
}

export interface Plan {
  id: "individual" | "organization" | "enterprise";
  name: string;
  positioning: string;
  features: string[];
  /** Days of free trial, or null. */
  trialDays: number | null;
  cta: { monthly: string; annual: string };
  ctaHref: string;
  /** Custom-priced plans carry no PlanPrice. */
  prices: { monthly: PlanPrice; annual: PlanPrice } | null;
}

const ngn = (amountNgn: number, interval: PlanPrice["interval"], perUser: boolean): PlanPrice => ({
  amountNgn,
  amountKobo: amountNgn * 100,
  interval,
  perUser,
  paystackPlanCode: null,
});

export const PLANS: Plan[] = [
  {
    id: "individual",
    name: "Individual",
    positioning: "For individuals building real SOC investigation skills.",
    features: [
      "Unlimited investigation scenarios",
      "Identity, endpoint, email & cloud investigation",
      "MITRE ATT&CK mapping",
      "Evidence-based scoring",
      "Investigation notes & timeline building",
      "Progress dashboard & investigation history",
      "Learning paths & certificates",
    ],
    trialDays: 7,
    cta: { monthly: "Start 7-Day Trial", annual: "Start 7-Day Trial" },
    ctaHref: "/signup",
    prices: {
      monthly: ngn(10_000, "monthly", false),
      annual: ngn(100_000, "annually", false),
    },
  },
  {
    id: "organization",
    name: "Organizations & Institutions",
    positioning: "For teams, cohorts, universities, bootcamps, and training programs.",
    features: [
      "Multiple learner accounts",
      "Cohort management",
      "Instructor dashboard",
      "Assign investigations & monitor progress",
      "Performance analytics & investigation scoring",
      "Reporting & instructor feedback",
      "Organization workspace",
      "Dedicated organization support",
    ],
    trialDays: null,
    cta: { monthly: "Get Started", annual: "Get Started" },
    ctaHref: "/contact",
    prices: {
      monthly: ngn(15_000, "monthly", true),
      annual: ngn(150_000, "annually", true),
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    positioning:
      "For organizations requiring scale, integrations, custom programs, and enterprise support.",
    features: [
      "SSO & advanced RBAC",
      "Large-scale user management",
      "Custom scenario & learning-path development",
      "Advanced analytics",
      "LMS & gradebook integration",
      "Dedicated support",
      "Custom deployment",
    ],
    trialDays: null,
    cta: { monthly: "Contact Us", annual: "Contact Us" },
    ctaHref: "/contact",
    prices: null,
  },
];

const NGN = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** "₦10,000" */
export function formatNgn(amountNgn: number): string {
  return NGN.format(amountNgn);
}

interface PriceDisplay {
  /** Headline, e.g. "₦10,000" or "Custom". */
  headline: string;
  /** Unit after the headline, e.g. "/month" or "/user/month". Empty for custom. */
  unit: string;
  /** Supporting line 1, e.g. "₦8,333/month, billed annually". */
  note?: string;
  /** Supporting line 2, e.g. "Save ₦20,000 annually". */
  savings?: string;
}

/**
 * Everything the pricing card needs to render for a plan in a given period. The annual note
 * and savings are derived from the two real prices, so they cannot drift out of sync with
 * them — the monthly-equivalent is annual ÷ 12, the saving is (12 × monthly) − annual.
 */
export function priceDisplay(plan: Plan, period: BillingPeriod): PriceDisplay {
  if (!plan.prices) {
    return { headline: "Custom", unit: "" };
  }
  const perUser = plan.prices.monthly.perUser;
  const unitSuffix = perUser ? "/user" : "";

  if (period === "monthly") {
    return {
      headline: formatNgn(plan.prices.monthly.amountNgn),
      unit: `${unitSuffix}/month`,
      note: plan.trialDays ? `${plan.trialDays}-day free trial` : undefined,
    };
  }

  const annual = plan.prices.annual.amountNgn;
  const monthly = plan.prices.monthly.amountNgn;
  const monthlyEquivalent = Math.round(annual / 12);
  const savingsPerYear = monthly * 12 - annual;

  return {
    headline: formatNgn(annual),
    unit: `${unitSuffix}/year`,
    note: `${formatNgn(monthlyEquivalent)}${unitSuffix}/month, billed annually`,
    savings:
      savingsPerYear > 0
        ? `Save ${formatNgn(savingsPerYear)}${perUser ? " per user" : ""} annually`
        : undefined,
  };
}
