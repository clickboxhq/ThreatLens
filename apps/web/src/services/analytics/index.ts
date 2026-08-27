import type { AnalyticsService } from "./analytics-service";
import { mockAnalyticsService } from "./mock-analytics-service";

export const analyticsService: AnalyticsService = mockAnalyticsService;
export type { AnalyticsService } from "./analytics-service";
