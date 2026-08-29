import { apiAnalyticsService } from "./api-analytics-service";
import type { AnalyticsService } from "./analytics-service";

export const analyticsService: AnalyticsService = apiAnalyticsService;
export type { AnalyticsService } from "./analytics-service";
