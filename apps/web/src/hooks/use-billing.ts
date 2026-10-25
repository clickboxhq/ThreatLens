import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billing";
import type { BillingIntervalId, BillingPlanId } from "@/types/billing";

const KEY = ["billing", "me"] as const;

/**
 * @param awaitingWebhook set after returning from Paystack. The redirect proves nothing —
 * only the signed webhook grants access — so the page polls briefly rather than claiming
 * success on a URL the browser was handed.
 */
export function useEntitlement(awaitingWebhook = false) {
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => billingService.mine(),
    // An account with no subscription is a normal answer, not a failure worth retrying.
    retry: false,
    refetchInterval: (q) => (awaitingWebhook && !q.state.data?.active ? 2_000 : false),
  });
  return {
    entitlement: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
  };
}

export function useBillingActions() {
  const queryClient = useQueryClient();

  const startCheckout = useMutation({
    mutationFn: (input: {
      planId: BillingPlanId;
      interval: BillingIntervalId;
      orgId?: string;
      trial?: boolean;
    }) => billingService.startCheckout(input),
  });

  const cancel = useMutation({
    mutationFn: () => billingService.cancel(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  return {
    startCheckout: startCheckout.mutateAsync,
    isStartingCheckout: startCheckout.isPending,
    cancel: cancel.mutateAsync,
    isCancelling: cancel.isPending,
  };
}
