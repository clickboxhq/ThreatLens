import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaystackClient } from './paystack.client';
import { BillingWebhookService } from './billing-webhook.service';
import { CheckoutService } from './checkout.service';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

export class StartCheckoutDto {
  @IsIn(['individual', 'organization'])
  planId!: 'individual' | 'organization';

  @IsIn(['monthly', 'annual'])
  interval!: 'monthly' | 'annual';

  /** Buying for the caller's organisation rather than themselves. */
  @IsOptional()
  @IsString()
  orgId?: string;
}

/**
 * The webhook, deliberately on its own controller.
 *
 * It carries no JwtAuthGuard because no browser calls it and no token exists to present —
 * the signature is the authentication. It also takes no body DTO: the global ValidationPipe
 * runs with `forbidNonWhitelisted`, which would reject Paystack's payload outright, and
 * there is nothing to gain from validating a body whose shape the provider owns.
 */
@Controller('billing/paystack')
export class PaystackWebhookController {
  constructor(
    private readonly paystack: PaystackClient,
    private readonly webhooks: BillingWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    const raw = req.rawBody;
    const signature = req.headers['x-paystack-signature'];

    if (
      !raw ||
      !this.paystack.verifySignature(raw, signature as string | undefined)
    ) {
      // 200 on purpose. A 4xx tells an attacker probing the endpoint that their forgery was
      // detected and invites them to keep tuning; it also makes Paystack retry a delivery we
      // will never accept. Nothing is recorded and nothing is processed.
      return { received: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      return { received: false };
    }

    await this.webhooks.receive(raw, parsed);
    return { received: true };
  }
}

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** What the caller is entitled to right now, for the billing page and feature gating. */
  @Get('me')
  async mine(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.describeFor(user);
  }

  @Post('checkout')
  async startCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartCheckoutDto,
  ) {
    return this.checkout.start(
      user,
      dto.planId,
      dto.interval,
      dto.orgId ?? null,
    );
  }
}
