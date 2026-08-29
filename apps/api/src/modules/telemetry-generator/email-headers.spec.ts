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

  it('renders the received chain newest-hop-first, as real headers are ordered', () => {
    const h = buildEmailHeaders(BASE) as Record<string, unknown>;
    const received = h['Received'] as string[];
    // Input is origin → edge; the header block reads edge (most recent) first.
    expect(received[0]).toContain('from edge-relay-01.example-mx.net');
    expect(received[received.length - 1]).toContain('from mail.evil.example');
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
