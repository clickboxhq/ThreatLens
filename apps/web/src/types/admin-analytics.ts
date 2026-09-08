// Wire contract for GET /admin/analytics/* — platform-operator business metrics
// (apps/api/src/modules/admin/analytics). platform_admin only; the backend RolesGuard
// enforces it, an org_admin or student gets a 403.

export type UserRoleKey = "student" | "instructor" | "org_admin" | "platform_admin";

export type PlatformOverview = {
  users: {
    total: number;
    byRole: Record<UserRoleKey, number>;
    newToday: number;
    newPast7Days: number;
    newPast30Days: number;
  };
  organizations: { total: number };
  revenue: PlatformRevenueSummary;
  generatedAt: string;
};

export type PlatformRevenueSummary = {
  /** False until a payment provider is connected — the UI shows "No payment data available". */
  available: boolean;
  reason: string | null;
  currency: string;
  grossRevenueCents: number;
  refundedCents: number;
  netRevenueCents: number;
  netRevenueThisMonthCents: number;
  netRevenueThisYearCents: number;
  payingCustomerCount: number;
};

export type CustomerType = "individual" | "organization";

export type CustomerRow = {
  customerId: string;
  name: string;
  type: CustomerType;
  memberCount: number | null;
  plan: string | null;
  subscriptionStatus: string | null;
  totalRevenueCents: number;
  currency: string;
  lastPaymentAt: string | null;
  createdAt: string;
};

export type CustomerPage = {
  data: CustomerRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  revenueAvailable: boolean;
};

export type CustomerQuery = {
  page?: number;
  limit?: number;
  search?: string;
  type?: CustomerType;
  sort?: "newest" | "oldest" | "name";
};
