import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingHttpHeaders } from 'http';
import { AppException } from '../../common/exceptions/app-exception';

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * How far an event's own timestamp may be from ours before we refuse it, per Paystack's
 * published tolerance. This is what stops someone replaying a delivery they captured
 * earlier, so it depends on this server's clock actually being right.
 */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Express gives a repeated header as an array; a signature header must be a single value. */
function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined {
  const value = headers[name];
  return typeof value === 'string' ? value : undefined;
}

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

  /**
   * The `whsec_` secrets that sign webhooks under Paystack's current scheme.
   *
   * A comma-separated list rather than one value, because rotating a signing secret means a
   * period where deliveries are signed with the old one or the new one and both have to be
   * accepted. Like the API key, these are per-mode: a test secret will not verify live
   * events.
   */
  private webhookSecrets(): string[] {
    return (this.config.get<string>('PAYSTACK_WEBHOOK_SECRET') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  isConfigured(): boolean {
    return Boolean(this.secretKey());
  }

  /** True when the key is a test key, which the UI surfaces so nobody mistakes it for live. */
  isTestMode(): boolean {
    return (this.secretKey() ?? '').startsWith('sk_test_');
  }

  /**
   * Decides whether an inbound webhook really came from Paystack.
   *
   * Paystack runs two signing schemes. The current one signs with a dedicated `whsec_`
   * secret and sends a `Paystack-Signature` header carrying a timestamp; the legacy one
   * signs with the API secret key and sends `x-paystack-signature`. Which one arrives
   * depends on whether the integration has an active signing secret for that mode, and that
   * can change under us without a deploy.
   *
   * So we accept either. That is not a weaker bar — both require a secret only Paystack and
   * this server hold — and it means the cutover is a non-event in both directions. If the
   * `whsec_` secret is unset, this degrades exactly to the old behaviour, which is what
   * makes this change safe to deploy before the variable exists.
   *
   * Getting this wrong fails silently: the controller answers 200 either way, so Paystack
   * records every rejected delivery as accepted and never retries it.
   */
  verifyWebhook(
    rawBody: Buffer,
    headers: IncomingHttpHeaders,
    now?: number,
  ): boolean {
    if (
      this.verifySignedHeader(
        rawBody,
        headerValue(headers, 'paystack-signature'),
        now,
      )
    ) {
      return true;
    }
    return this.verifySignature(
      rawBody,
      headerValue(headers, 'x-paystack-signature'),
    );
  }

  /**
   * The current scheme: `Paystack-Signature: t=<unix>,v1=<kid>:<hex>`.
   *
   * The signed bytes are the timestamp, a literal dot, then the raw body — not the body
   * alone — so a signature that verifies here could not have been lifted from an older
   * delivery and replayed, provided the timestamp is still within tolerance.
   *
   * An event may carry several `v1` entries during a secret rotation, so every one is
   * checked against every configured secret.
   */
  verifySignedHeader(
    rawBody: Buffer,
    header: string | undefined,
    now = Math.floor(Date.now() / 1000),
  ): boolean {
    const secrets = this.webhookSecrets();
    if (!secrets.length || !header) return false;

    let timestamp: number | null = null;
    const candidates: string[] = [];

    for (const part of header.split(',')) {
      const i = part.indexOf('=');
      if (i === -1) continue;
      const key = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();

      if (key === 't') {
        // A second `t` means the header is malformed or crafted. Refusing beats picking one
        // of them and hoping.
        if (timestamp !== null || !/^[0-9]+$/.test(value)) return false;
        timestamp = Number(value);
      } else if (key === 'v1') {
        const j = value.indexOf(':');
        // `<kid>:<signature>` — the key id only says which secret signed it, so it is the
        // signature that has to match, not the id.
        if (j !== -1) candidates.push(value.slice(j + 1));
      }
      // Anything else in the header is ignored on purpose: Paystack may add fields, and a
      // stricter parse would start rejecting valid events the day they do.
    }

    if (timestamp === null || candidates.length === 0) return false;
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

    for (const secret of secrets) {
      const expected = createHmac('sha512', secret)
        .update(`${timestamp}.`)
        .update(rawBody)
        .digest();

      for (const hex of candidates) {
        // Guard the shape before decoding: Buffer.from silently truncates at the first
        // non-hex character, which would compare a short buffer and could match by accident.
        if (!/^[0-9a-f]{128}$/.test(hex)) continue;
        const given = Buffer.from(hex, 'hex');
        if (
          given.length === expected.length &&
          timingSafeEqual(given, expected)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * The legacy scheme: `x-paystack-signature`, an HMAC of the raw body under the API secret
   * key, with no timestamp and so no replay protection of its own.
   *
   * It must be the RAW body. Paystack signs the exact bytes it sent, so a payload that Nest
   * parsed and this code re-serialised will differ by key order or whitespace and never
   * match — and it fails looking exactly like a wrong secret key, which is why the raw body
   * is threaded all the way through rather than reconstructed here.
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

  /**
   * Schedules the subscription that ends a free trial.
   *
   * `startDate` is when Paystack first debits the card, so a date seven days out is what
   * makes the trial free: the card is captured now, charged then, and recurs from there.
   * Paystack will only accept this once the customer has a reusable authorisation, which is
   * why a verification charge has to come first — there is no zero-amount card save.
   */
  async createSubscription(input: {
    customerCode: string;
    planCode: string;
    authorizationCode: string;
    startDate: Date;
  }): Promise<{ subscriptionCode: string | null; emailToken: string | null }> {
    const json = await this.post<{
      data?: { subscription_code?: string; email_token?: string };
    }>('/subscription', {
      customer: input.customerCode,
      plan: input.planCode,
      authorization: input.authorizationCode,
      start_date: input.startDate.toISOString(),
    });
    return {
      subscriptionCode: json.data?.subscription_code ?? null,
      // Paystack requires this alongside the code to cancel, so it is stored now rather
      // than re-fetched later when someone is waiting on a cancel button.
      emailToken: json.data?.email_token ?? null,
    };
  }

  /**
   * Stops a subscription renewing. Paystack needs the email token alongside the code; it
   * comes back on the subscription record and is stored when the subscription is created.
   */
  async disableSubscription(input: {
    subscriptionCode: string;
    emailToken: string;
  }): Promise<void> {
    await this.post('/subscription/disable', {
      code: input.subscriptionCode,
      token: input.emailToken,
    });
  }

  /** Returns the card-verification charge. Called as soon as the authorisation exists. */
  async refund(reference: string): Promise<void> {
    await this.post('/refund', { transaction: reference });
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
