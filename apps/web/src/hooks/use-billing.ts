import { useQuery } from "@tanstack/react-query";
import { billingService } from "@/services/billing";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useBilling() {
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.billing, "summary"],
    queryFn: () => billingService.getSummary(),
  });
  const invoicesQuery = useQuery({
    queryKey: [...queryKeys.billing, "invoices"],
    queryFn: () => billingService.listInvoices(),
  });
  const seatsQuery = useQuery({
    queryKey: [...queryKeys.billing, "seats"],
    queryFn: () => billingService.listSeatUtilization(),
  });
  return {
    summary: summaryQuery.data,
    invoices: invoicesQuery.data ?? [],
    seatUtilization: seatsQuery.data ?? [],
    state: deriveViewState(invoicesQuery),
  };
}
