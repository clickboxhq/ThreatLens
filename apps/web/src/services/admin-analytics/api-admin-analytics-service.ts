import { apiClient } from "@/lib/api-client";
import type { AdminAnalyticsService } from "./admin-analytics-service";
import type { CustomerPage, PlatformOverview } from "@/types/admin-analytics";

export const apiAdminAnalyticsService: AdminAnalyticsService = {
  getOverview: () => apiClient.get<PlatformOverview>("/admin/analytics/overview"),

  getCustomers: (query = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.search) params.set("search", query.search);
    if (query.type) params.set("type", query.type);
    if (query.sort) params.set("sort", query.sort);
    const qs = params.toString();
    return apiClient.get<CustomerPage>(`/admin/analytics/customers${qs ? `?${qs}` : ""}`);
  },
};
