import { apiBillingService } from "./api-billing-service";
import type { BillingService } from "./billing-service";

export const billingService: BillingService = apiBillingService;

export type { BillingService } from "./billing-service";
