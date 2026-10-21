import { createHmac } from 'crypto';
import { PaystackClient } from './paystack.client';
import type { ConfigService } from '@nestjs/config';

const SECRET = 'sk_test_abc123def456';

// null means "no key configured" — an explicit undefined would hit the default.
function build(secret: string | null = SECRET): PaystackClient {
  const config = {
    get: (key: string) =>
      key === 'PAYSTACK_SECRET_KEY' ? (secret ?? undefined) : undefined,
  } as unknown as ConfigService;
  return new PaystackClient(config);
}

const sign = (body: Buffer, secret = SECRET) =>
  createHmac('sha512', secret).update(body).digest('hex');

/**
 * This is the boundary that decides whether an inbound payload is allowed to move money and
 * grant access. Everything downstream trusts it completely, so it is the one piece here that
 * must be tested rather than reasoned about.
 */
describe('PaystackClient.verifySignature', () => {
  const body = Buffer.from(
    JSON.stringify({ event: 'charge.success', data: { reference: 'tl_1' } }),
  );

  it('accepts a payload signed with the secret key', () => {
    expect(build().verifySignature(body, sign(body))).toBe(true);
  });

  it('rejects a forged signature', () => {
    expect(build().verifySignature(body, 'a'.repeat(128))).toBe(false);
  });

  it('rejects a signature made with a different key', () => {
    const theirs = sign(body, 'sk_test_someone_elses_key');
    expect(build().verifySignature(body, theirs)).toBe(false);
  });

  it('rejects when the body has been altered after signing', () => {
    // The whole point: an attacker who captures a real delivery must not be able to change
    // the amount and replay it.
    const signature = sign(body);
    const tampered = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: 'tl_1', amount: 99999999 },
      }),
    );
    expect(build().verifySignature(tampered, signature)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(build().verifySignature(body, undefined)).toBe(false);
  });

  it('rejects everything when no key is configured', () => {
    // An environment with no Paystack key must not accept webhooks at all, rather than
    // falling back to some permissive default.
    expect(build(null).verifySignature(body, sign(body))).toBe(false);
  });

  it('does not throw on a signature of the wrong length', () => {
    // timingSafeEqual throws on a length mismatch, so the length is checked first.
    expect(() => build().verifySignature(body, 'abc')).not.toThrow();
    expect(build().verifySignature(body, 'abc')).toBe(false);
  });

  it('is byte-sensitive to key order, which is why the raw body is used', () => {
    // Same object, different serialisation. A handler that re-stringified a parsed body
    // would produce this and fail to verify.
    const reordered = Buffer.from(
      JSON.stringify({ data: { reference: 'tl_1' }, event: 'charge.success' }),
    );
    expect(build().verifySignature(reordered, sign(body))).toBe(false);
  });
});

describe('PaystackClient configuration', () => {
  it('reports itself unconfigured with no key', () => {
    expect(build(null).isConfigured()).toBe(false);
  });

  it('recognises a test key, so the UI can say so', () => {
    expect(build('sk_test_x').isTestMode()).toBe(true);
    expect(build('sk_live_x').isTestMode()).toBe(false);
  });
});
