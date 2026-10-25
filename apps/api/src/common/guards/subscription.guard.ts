import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AppException } from '../exceptions/app-exception';
import { AuthenticatedUser } from './jwt-auth.guard';
import { SubscriptionService } from '../../modules/billing/subscription.service';
import { NO_SUBSCRIPTION_REQUIRED } from '../decorators/no-subscription-required.decorator';

/**
 * Requires paid access — a trial counts.
 *
 * ThreatLens has no free tier: an account is either inside its free trial, covered by an
 * organisation's subscription, or paying. This guard is what makes that true, and it is
 * applied to the product surface only.
 *
 * What is deliberately NOT behind it, because gating these would trap people:
 *
 *   - billing, so somebody whose trial has lapsed can still reach the page that takes money;
 *   - auth and profile, so they can sign in, sign out and see their own account;
 *   - invite previews and certificate verification, which are reached without an account;
 *   - the admin surface, which is staff running the platform rather than customers using it.
 *
 * Platform admins are exempt outright. They are staff, not customers, and an operator locked
 * out of the admin panel by a billing state is an operator who cannot fix the billing state.
 *
 * Order matters where this is applied: it must come after JwtAuthGuard in the @UseGuards
 * list, because it reads the caller that guard attaches.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const exempt = this.reflector.getAllAndOverride<boolean>(
      NO_SUBSCRIPTION_REQUIRED,
      [context.getHandler(), context.getClass()],
    );
    if (exempt) return true;

    const user = request.user;
    // No caller means JwtAuthGuard has not run or has let an unauthenticated request
    // through. Deciding entitlement is not this guard's job in that case; authentication is.
    if (!user) return true;

    if (user.role === 'platform_admin') return true;

    if (await this.subscriptions.hasActiveAccess(user)) return true;

    throw new AppException(
      402,
      'SUBSCRIPTION_REQUIRED',
      'Your trial has ended. Start a subscription to continue.',
    );
  }
}
