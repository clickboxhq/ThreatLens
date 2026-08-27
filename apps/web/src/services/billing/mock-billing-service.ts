import type { BillingService } from "./billing-service";

const invoices = [
  {
    id: "INV-2026-08",
    period: "Aug 2026",
    seats: 128,
    amount: "$18,432.00",
    status: "Open" as const,
  },
  {
    id: "INV-2026-07",
    period: "Jul 2026",
    seats: 121,
    amount: "$17,424.00",
    status: "Paid" as const,
  },
  {
    id: "INV-2026-06",
    period: "Jun 2026",
    seats: 118,
    amount: "$16,992.00",
    status: "Paid" as const,
  },
  {
    id: "INV-2026-05",
    period: "May 2026",
    seats: 104,
    amount: "$14,976.00",
    status: "Paid" as const,
  },
];

const seatUtilization = [
  { label: "Analysts", value: "112 / 130", meter: 86 },
  { label: "Instructors", value: "12 / 15", meter: 80 },
  { label: "Administrators", value: "4 / 5", meter: 80 },
];

export const mockBillingService: BillingService = {
  getSummary: () =>
    Promise.resolve({
      plan: "Enterprise",
      subscriptionStatus: "active",
      activeSeats: 128,
      licensedSeats: 150,
      scenarioLaunches: 3214,
      billingCycle: "annual",
      renewalDate: "Jun 24, 2027",
      paymentMethod: "Visa •••• 4242",
      nextInvoiceAmount: "$18,432",
      nextInvoiceDue: "Sep 01",
    }),
  listInvoices: () => Promise.resolve(invoices),
  listSeatUtilization: () => Promise.resolve(seatUtilization),
};
