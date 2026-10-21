import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AppException } from '../../common/exceptions/app-exception';

const PAYSTACK_API = 'https://api.paystack.co';

export interface InitializeTransactionInput {
  email: string;
  /** Kobo. Paystack transacts in the minor unit; `lib/pricing.ts` already stores it. */
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  /** Set for a recurring plan; omitted for a one-off charge. */
  planCode?: string | null;
  metadata?: Record<string, unknown>;
}

export interface InitializedTransaction {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * The only code that talks to Paystack.
 *
 * Two jobs, and the second matters more than the first: starting a transaction, and deciding
 * whether an inbound webhook really came from Paystack. Everything downstream of
 * `verifySignature` trusts the payload completely — it moves money in the ledger and grants
 * access — so this is the boundary that has to be right.
 */
@Injectable()
export class PaystackClient {
  private readonly logger = new Logger(PaystackClient.name);

  constructor(private readonly config: ConfigService) {}

  private secretKey(): string | undefined {
    return this.config.get<string>('PAYSTACK_SECRET_KEY');
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey());
  }

  /** True when the key is a test key, which the UI surfaces so nobody mistakes it for live. */
  isTestMode(): boolean {
    return (this.secretKey() ?? '').startsWith('sk_test_');
  }

  /**
   * Checks the `x-paystack-signature` header against the body as it arrived.
   *
   * It must be the RAW body. Paystack signs the exact bytes it sent, so a payload that Nest
   * parsed and this code re-serialised will differ by key order or whitespace and never
   * match — and it fails looking exactly like a wrong secret key, which is why the raw body
   * is threaded all the way through rather than reconstructed here.
   *
   * There is no separate webhook secret in Paystack: the API secret key signs the payload.
   */
  verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = this.secretKey();
    if (!secret || !signature) return false;

    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const given = Buffer.from(signature, 'utf8');
    const mine = Buffer.from(expected, 'utf8');

    // Compare in constant time, and only once the lengths match — timingSafeEqual throws on
    // a length mismatch, which would itself leak the digest length.
    if (given.length !== mine.length) return false;
    return timingSafeEqual(given, mine);
  }

  async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializedTransaction> {
    const body: Record<string, unknown> = {
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: 'NGN',
      metadata: input.metadata ?? {},
    };
    if (input.planCode) body.plan = input.planCode;

    const json = await this.post<{
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    }>('/transaction/initialize', body);

    const data = json.data;
    if (!data?.authorization_url || !data.access_code) {
      throw new AppException(
        502,
        'PAYMENT_PROVIDER_ERROR',
        'The payment provider did not return a checkout link.',
      );
    }
    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference ?? input.reference,
    };
  }

  /**
   * Asks Paystack what actually happened to a transaction.
   *
   * Used when someone returns from checkout, so the page can say something true immediately
   * instead of waiting on a webhook. It never writes the ledger — only the webhook does —
   * because a browser returning to a callback URL proves nothing about whether money moved.
   */
  async verifyTransaction(reference: string): Promise<{
    status: string;
    amountKobo: number;
    paidAt: string | null;
  }> {
    const json = await this.post<{
      data?: { status?: string; amount?: number; paid_at?: string | null };
    }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      undefined,
      'GET',
    );

    return {
      status: json.data?.status ?? 'unknown',
      amountKobo: json.data?.amount ?? 0,
      paidAt: json.data?.paid_at ?? null,
    };
  }

  private async post<T>(
    path: string,
    body?: Record<string, unknown>,
    method: 'POST' | 'GET' = 'POST',
  ): Promise<T> {
    const secret = this.secretKey();
    if (!secret) {
      throw new AppException(
        503,
        'PAYMENTS_UNAVAILABLE',
        'Payments are not configured on this environment.',
      );
    }

    let res: Response;
    try {
      res = await fetch(`${PAYSTACK_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(
        `Paystack ${method} ${path} failed to send: ${(err as Error).message}`,
      );
      throw new AppException(
        503,
        'PAYMENTS_UNAVAILABLE',
        'Could not reach the payment provider. Nothing was charged.',
      );
    }

    const json = (await res.json().catch(() => null)) as
      (T & { status?: boolean; message?: string }) | null;

    if (!res.ok || !json || json.status === false) {
      // Never log the response body wholesale — it echoes back the request, key included.
      this.logger.error(
        `Paystack ${method} ${path} returned ${res.status}: ${json?.message ?? 'no message'}`,
      );
      throw new AppException(
        502,
        'PAYMENT_PROVIDER_ERROR',
        'The payment provider rejected the request. Nothing was charged.',
      );
    }
    return json;
  }
}
