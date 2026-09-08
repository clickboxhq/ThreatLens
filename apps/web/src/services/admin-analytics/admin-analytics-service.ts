import type { CustomerPage, CustomerQuery, PlatformOverview } from "@/types/admin-analytics";

/** platform_admin-only on the backend (RolesGuard) — see app-shell.tsx's nav gating. */
export interface AdminAnalyticsService {
  getOverview(): Promise<PlatformOverview>;
  getCustomers(query?: CustomerQuery): Promise<CustomerPage>;
}
