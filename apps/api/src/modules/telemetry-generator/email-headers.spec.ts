import { buildEmailHeaders } from './templates';

const BASE = {
  messageId: '<abc@evil.example>',
  senderDisplayName: 'Morgan Reyes (Chief Financial Officer)',
  senderAddress: 'm.reyes@evil.example',
  recipientAddresses: ['victim@corp.example'],
  subject: 'URGENT: wire transfer',
  occurredAt: new Date('2026-08-01T10:00:00Z'),
  receivedChain: ['mail.evil.example', 'edge-relay-01.example-mx.net'],
  authenticationResults:
    'spf=fail smtp.mailfrom=evil.example; dkim=none; dmarc=fail',
};

// These headers are what the Email Investigation portal's analysis reads, so their shape is a
// real contract, not incidental formatting.
describe('buildEmailHeaders', () => {
  it('produces the standard header set a mail client would show', () => {
    const h = buildEmailHeaders(BASE) as Record<string, unknown>;

    expect(h['Message-ID']).toBe('<abc@evil.example>');
    expect(h['From']).toBe(
      '"Morgan Reyes (Chief Financial Officer)" <m.reyes@evil.example>',
    );
    expect(h['To']).toBe('victim@corp.example');
    expect(h['Subject']).toBe('URGENT: wire transfer');
    expect(h['Authentication-Results']).toContain('spf=fail');
    expect(h['MIME-Version']).toBe('1.0');
  });

  it('defaults Return-Path to the sender when no separate envelope sender is given', () => {
    const h = buildEmailHeaders(BASE) as Record<string, unknown>;
    expect(h['Return-Path']).toBe('<m.reyes@evil.example>');
  });

  // An earlier version of this builder paired the hops backwards (claiming the edge relay
  // delivered to the *sender's* own mail server) and still passed a looser test that only
  // checked which hosts appeared. Assert the actual from→by chain, since a header block that
  // reads backwards would teach the opposite of how to trace a message's origin.
  it('chains received hops from→by along the real path, newest hop first', () => {
    const h = buildEmailHeaders(BASE) as Record<string, unknown>;
    const received = h['Received'] as string[];

    // Path is: mail.evil.example → edge-relay-01.example-mx.net → mx.corp.internal
    expect(received).toHaveLength(2);
    expect(received[0]).toContain(
      'from edge-relay-01.example-mx.net by mx.corp.internal',
    );
    expect(received[1]).toContain(
      'from mail.evil.example by edge-relay-01.example-mx.net',
    );
  });

  it('handles a single-hop chain (delivered straight to our MX)', () => {
    const h = buildEmailHeaders({
      ...BASE,
      receivedChain: ['mail.internal.example'],
    }) as Record<string, unknown>;
    const received = h['Received'] as string[];

    expect(received).toHaveLength(1);
    expect(received[0]).toContain(
      'from mail.internal.example by mx.corp.internal',
    );
  });

  it('omits Reply-To and X-Originating-IP entirely when not supplied', () => {
    const h = buildEmailHeaders(BASE) as Record<string, unknown>;
    expect('Reply-To' in h).toBe(false);
    expect('X-Originating-IP' in h).toBe(false);
  });

  it('includes Reply-To when the message redirects replies (the BEC tell)', () => {
    const h = buildEmailHeaders({
      ...BASE,
      replyTo: 'm.reyes.finance@evil.example',
      returnPath: 'bounce@evil.example',
    }) as Record<string, unknown>;

    expect(h['Reply-To']).toBe('<m.reyes.finance@evil.example>');
    expect(h['Return-Path']).toBe('<bounce@evil.example>');
  });
});
