import type { Invoice, BillingSummary, SeatUtilization } from "@/types/billing";

export interface BillingService {
  getSummary(): Promise<BillingSummary>;
  listInvoices(): Promise<Invoice[]>;
  listSeatUtilization(): Promise<SeatUtilization[]>;
}
