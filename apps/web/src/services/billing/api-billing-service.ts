import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { BillingService } from "./billing-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`BillingService.${method}`);
};

export const apiBillingService: BillingService = {
  getSummary: () => notConnected("getSummary"),
  listInvoices: () => notConnected("listInvoices"),
  listSeatUtilization: () => notConnected("listSeatUtilization"),
};
