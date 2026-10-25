import { SetMetadata } from '@nestjs/common';

export const NO_SUBSCRIPTION_REQUIRED = 'no_subscription_required';

/**
 * Lets one route through SubscriptionGuard on an otherwise gated controller.
 *
 * Used where gating would trap somebody outside the paywall with no way in: accepting an
 * organisation invitation, and creating an organisation. Both are how an account becomes
 * covered by a subscription, so requiring one first is a closed loop.
 */
export const NoSubscriptionRequired = () =>
  SetMetadata(NO_SUBSCRIPTION_REQUIRED, true);
