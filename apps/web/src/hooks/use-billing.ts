import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { billingService } from "@/services/billing";
import type { BillingIntervalId, BillingPlanId } from "@/types/billing";

const KEY = ["billing", "me"] as const;

/**
 * How long to keep waiting for the webhook before saying so. A delivery normally lands in
 * seconds; the point of the limit is the case where it never will — a declined card, an
 * abandoned checkout, a webhook that cannot reach us. Waiting forever on those shows
 * somebody "this usually takes a few seconds" until they give up, which is worse than
 * telling them it did not work.
 */
const WEBHOOK_WAIT_MS = 90_000;

/**
 * @param awaitingWebhook set after returning from Paystack. The redirect proves nothing —
 * only the signed webhook grants access — so the page polls briefly rather than claiming
 * success on a URL the browser was handed.
 */
export function useEntitlement(awaitingWebhook = false) {
  const [waitedOut, setWaitedOut] = useState(false);

  useEffect(() => {
    if (!awaitingWebhook) return;
    setWaitedOut(false);
    const timer = setTimeout(() => setWaitedOut(true), WEBHOOK_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingWebhook]);

  const query = useQuery({
    queryKey: KEY,
    queryFn: () => billingService.mine(),
    // An account with no subscription is a normal answer, not a failure worth retrying.
    retry: false,
    refetchInterval: (q) =>
      awaitingWebhook && !waitedOut && !q.state.data?.active ? 2_000 : false,
  });

  return {
    entitlement: query.data ?? null,
    isPending: query.isPending,
    isError: query.isError,
    // The wait ran out and nothing arrived. Access is still decided only by the webhook —
    // this says to stop waiting and offer a way forward, never that anything was granted.
    confirmationTimedOut: waitedOut && !query.data?.active,
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
