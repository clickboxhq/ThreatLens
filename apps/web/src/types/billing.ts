export type InvoiceStatus = "Open" | "Paid";

export type Invoice = {
  id: string;
  period: string;
  seats: number;
  amount: string;
  status: InvoiceStatus;
};

export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled" | "expired";

export type BillingSummary = {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  activeSeats: number;
  licensedSeats: number;
  scenarioLaunches: number;
  billingCycle: "monthly" | "annual";
  renewalDate: string;
  paymentMethod: string;
  nextInvoiceAmount: string;
  nextInvoiceDue: string;
};

export type SeatUtilization = { label: string; value: string; meter: number };
