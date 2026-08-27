import type { BillingService } from "./billing-service";
import { mockBillingService } from "./mock-billing-service";

export const billingService: BillingService = mockBillingService;
export type { BillingService } from "./billing-service";
