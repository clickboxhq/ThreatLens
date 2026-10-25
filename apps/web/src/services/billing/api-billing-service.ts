import { apiClient } from "@/lib/api-client";
import type { BillingService } from "./billing-service";
import type { CancellationDto, CheckoutSessionDto, EntitlementDto } from "@/types/billing";

export const apiBillingService: BillingService = {
  mine: () => apiClient.get<EntitlementDto>("/billing/me"),
  startCheckout: (input) => apiClient.post<CheckoutSessionDto>("/billing/checkout", input),
  cancel: () => apiClient.post<CancellationDto>("/billing/cancel"),
};
