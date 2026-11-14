import { createHmac } from 'crypto';
import { PaystackClient } from './paystack.client';
import type { ConfigService } from '@nestjs/config';
import type { IncomingHttpHeaders } from 'http';

const SECRET = 'sk_test_abc123def456';
const WHSEC = 'whsec_test_112233445566';

// null means "not configured" — an explicit undefined would hit the default.
function build(
  secret: string | null = SECRET,
  webhookSecret: string | null = WHSEC,
): PaystackClient {
  const config = {
    get: (key: string) => {
      if (key === 'PAYSTACK_SECRET_KEY') return secret ?? undefined;
      if (key === 'PAYSTACK_WEBHOOK_SECRET') return webhookSecret ?? undefined;
      return undefined;
    },
  } as unknown as ConfigService;
  return new PaystackClient(config);
}

const sign = (body: Buffer, secret = SECRET) =>
  createHmac('sha512', secret).update(body).digest('hex');

const signModern = (body: Buffer, t: number, secret = WHSEC) =>
  createHmac('sha512', secret).update(`${t}.`).update(body).digest('hex');

const header = (
  body: Buffer,
  t: number,
  secret = WHSEC,
  kid = 'whk_3f9a1c2e',
) => `t=${t},v1=${kid}:${signModern(body, t, secret)}`;

const NOW = 1794400000;

const body = Buffer.from(
  JSON.stringify({ event: 'charge.success', data: { reference: 'tl_1' } }),
);

/**
 * This is the boundary that decides whether an inbound payload is allowed to move money and
 * grant access. Everything downstream trusts it completely, so it is the one piece here that
 * must be tested rather than reasoned about.
 *
 * It matters more than most such boundaries because failure is silent: the controller
 * answers 200 whatever happens, so a delivery rejected here is one Paystack records as
 * accepted and never sends again.
 */
describe('PaystackClient.verifySignedHeader (current scheme)', () => {
  it('accepts an event signed with the webhook signing secret', () => {
    expect(build().verifySignedHeader(body, header(body, NOW), NOW)).toBe(true);
  });

  it('rejects an event signed with a different secret', () => {
    const theirs = header(body, NOW, 'whsec_someone_elses');
    expect(build().verifySignedHeader(body, theirs, NOW)).toBe(false);
  });

  it('rejects a body altered after signing', () => {
    const signed = header(body, NOW);
    const tampered = Buffer.from(
      JSON.stringify({
        event: 'charge.success',
        data: { reference: 'tl_1', amount: 99999999 },
      }),
    );
    expect(build().verifySignedHeader(tampered, signed, NOW)).toBe(false);
  });

  it('rejects a delivery replayed after the tolerance window', () => {
    // The point of the timestamp: a captured delivery stops being usable, where under the
    // legacy scheme it stayed valid forever.
    const old = header(body, NOW - 301);
    expect(build().verifySignedHeader(body, old, NOW)).toBe(false);
  });

  it('rejects a timestamp too far in the future', () => {
    // Clock skew cuts both ways, so the window is checked in both directions.
    const ahead = header(body, NOW + 301);
    expect(build().verifySignedHeader(body, ahead, NOW)).toBe(false);
  });

  it('accepts at the edge of the tolerance window', () => {
    expect(build().verifySignedHeader(body, header(body, NOW - 300), NOW)).toBe(
      true,
    );
  });

  it('accepts when any one of several signatures matches', () => {
    // Paystack sends more than one v1 while a secret is being rotated on their side.
    const stale = `v1=whk_old:${'0'.repeat(128)}`;
    const good = `v1=whk_new:${signModern(body, NOW)}`;
    expect(
      build().verifySignedHeader(body, `t=${NOW},${stale},${good}`, NOW),
    ).toBe(true);
  });

  it('accepts when any one of several configured secrets matches', () => {
    // The other half of a rotation: we hold both until Paystack stops using the old one.
    const client = build(SECRET, `whsec_retired,${WHSEC}`);
    expect(client.verifySignedHeader(body, header(body, NOW), NOW)).toBe(true);
  });

  it('ignores unrecognised fields rather than rejecting the event', () => {
    // Paystack may add fields; a stricter parse would start dropping valid events the day
    // they do.
    const extended = `${header(body, NOW)},v0=something,note=ignored`;
    expect(build().verifySignedHeader(body, extended, NOW)).toBe(true);
  });

  it('rejects a header carrying two timestamps', () => {
    const good = signModern(body, NOW);
    const crafted = `t=${NOW},t=${NOW - 10000},v1=whk_a:${good}`;
    expect(build().verifySignedHeader(body, crafted, NOW)).toBe(false);
  });

  it('rejects a non-numeric timestamp', () => {
    const crafted = `t=not-a-number,v1=whk_a:${signModern(body, NOW)}`;
    expect(build().verifySignedHeader(body, crafted, NOW)).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    // Buffer.from('zz', 'hex') truncates silently, so the shape is checked before decoding.
    const short = `t=${NOW},v1=whk_a:abc`;
    const nonHex = `t=${NOW},v1=whk_a:${'z'.repeat(128)}`;
    expect(() => build().verifySignedHeader(body, short, NOW)).not.toThrow();
    expect(build().verifySignedHeader(body, short, NOW)).toBe(false);
    expect(build().verifySignedHeader(body, nonHex, NOW)).toBe(false);
  });

  it('rejects a header with a timestamp but no signature', () => {
    expect(build().verifySignedHeader(body, `t=${NOW}`, NOW)).toBe(false);
  });

  it('rejects everything when no signing secret is configured', () => {
    expect(
      build(SECRET, null).verifySignedHeader(body, header(body, NOW), NOW),
    ).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(build().verifySignedHeader(body, undefined, NOW)).toBe(false);
  });
});

/**
 * The dispatcher. Which scheme arrives is Paystack's decision, not ours, and it can change
 * without a deploy — so both paths have to work, in both directions.
 */
describe('PaystackClient.verifyWebhook', () => {
  const modernHeaders = (t = NOW): IncomingHttpHeaders => ({
    'paystack-signature': header(body, t),
  });
  const legacyHeaders = (): IncomingHttpHeaders => ({
    'x-paystack-signature': sign(body),
  });

  it('accepts a current-scheme delivery', () => {
    expect(build().verifyWebhook(body, modernHeaders(), NOW)).toBe(true);
  });

  it('accepts a legacy delivery', () => {
    expect(build().verifyWebhook(body, legacyHeaders(), NOW)).toBe(true);
  });

  it('falls back to the legacy header when no signing secret is set yet', () => {
    // The deploy-before-configure case: this change ships before the variable exists, and
    // must not break the webhooks that are working today.
    const client = build(SECRET, null);
    const headers = { ...modernHeaders(), ...legacyHeaders() };
    expect(client.verifyWebhook(body, headers, NOW)).toBe(true);
  });

  it('accepts a current-scheme delivery once the legacy header stops arriving', () => {
    // The other end of the same migration.
    expect(build().verifyWebhook(body, modernHeaders(), NOW)).toBe(true);
  });

  it('rejects when neither header verifies', () => {
    const headers: IncomingHttpHeaders = {
      'paystack-signature': `t=${NOW},v1=whk_a:${'0'.repeat(128)}`,
      'x-paystack-signature': 'a'.repeat(128),
    };
    expect(build().verifyWebhook(body, headers, NOW)).toBe(false);
  });

  it('rejects a repeated signature header', () => {
    // Express surfaces a duplicated header as an array; there is no honest way to read that
    // as one signature, so it is refused rather than guessed at.
    const headers = {
      'x-paystack-signature': [sign(body), sign(body)],
    } as unknown as IncomingHttpHeaders;
    expect(build().verifyWebhook(body, headers, NOW)).toBe(false);
  });

  it('rejects a request carrying no signature at all', () => {
    expect(build().verifyWebhook(body, {}, NOW)).toBe(false);
  });
});

describe('PaystackClient.verifySignature (legacy scheme)', () => {
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
