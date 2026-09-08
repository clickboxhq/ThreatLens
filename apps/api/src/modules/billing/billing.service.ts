import { Injectable } from '@nestjs/common';
import type { CustomerRevenue, PlatformRevenueSummary } from './billing.types';

const NO_PROVIDER_REASON = 'no_payment_provider';
const DEFAULT_CURRENCY = 'USD';

/**
 * The billing seam.
 *
 * ThreatLens has no payment provider integrated. Rather than invent revenue — the brief is
 * explicit about not doing that, and app.billing.tsx already had mock invoices removed for
 * reading as real money owed — this service is the single place a real integration will land.
 *
 * When a provider (Stripe, Paddle, …) is added:
 *   - a `payments` / `refunds` ledger (provider event id, customer id, amount, status,
 *     occurredAt) is written ONLY by a signed, idempotent webhook handler — never by a
 *     frontend request claiming success;
 *   - `getPlatformRevenueSummary` and `getRevenueByCustomer` become aggregate queries over
 *     that ledger, counting captured payments net of refunds/reversals and de-duplicating
 *     repeated webhook deliveries by provider event id;
 *   - `isConfigured()` flips to true and the rest of the app (admin analytics, a real billing
 *     page) starts showing figures with no further shape changes.
 *
 * Until then every method returns an explicit "not available" result.
 */
@Injectable()
export class BillingService {
  isConfigured(): boolean {
    return false;
  }

  getPlatformRevenueSummary(): PlatformRevenueSummary {
    return {
      available: false,
      reason: NO_PROVIDER_REASON,
      currency: DEFAULT_CURRENCY,
      grossRevenueCents: 0,
      refundedCents: 0,
      netRevenueCents: 0,
      netRevenueThisMonthCents: 0,
      netRevenueThisYearCents: 0,
      payingCustomerCount: 0,
    };
  }

  /**
   * Revenue keyed by billing-customer id (a user id for an individual, an organization id for
   * an org — the caller decides which ids to ask about). Returns an empty map today; every
   * customer the admin list renders then shows zero / "—", which is the honest state.
   */
  getRevenueByCustomer(customerIds: string[]): Map<string, CustomerRevenue> {
    // No provider connected, so no customer has any confirmed revenue — every requested id
    // simply maps to nothing. Kept as a parameter so the real implementation is a drop-in.
    void customerIds;
    return new Map();
  }
}
