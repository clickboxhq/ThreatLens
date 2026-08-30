import { senderDomainRegisteredAt } from './domain-age';
import {
  ORG_DOMAIN,
  MALICIOUS_DOMAIN,
  EXEC_LOOKALIKE_DOMAIN,
} from './templates';

const NOW = new Date('2026-08-30T00:00:00Z');
const ageDays = (d: Date | null) =>
  d === null ? null : Math.round((NOW.getTime() - d.getTime()) / 86_400_000);

describe('sender domain age', () => {
  it('reports campaign infrastructure as days old, not years', () => {
    expect(
      ageDays(senderDomainRegisteredAt(`x@${MALICIOUS_DOMAIN}`, NOW)),
    ).toBeLessThan(30);
    expect(
      ageDays(senderDomainRegisteredAt(`x@${EXEC_LOOKALIKE_DOMAIN}`, NOW)),
    ).toBeLessThan(30);
  });

  it('gives the real corporate domain years of history', () => {
    expect(
      ageDays(senderDomainRegisteredAt(`x@${ORG_DOMAIN}`, NOW)),
    ).toBeGreaterThan(5 * 365);
  });

  // The lookalike is the whole point of the signal: it must be clearly newer than the domain
  // it imitates, or an analyst comparing the two learns nothing from the comparison.
  it('makes a lookalike domain far newer than the domain it imitates', () => {
    const real = ageDays(senderDomainRegisteredAt(`x@${ORG_DOMAIN}`, NOW))!;
    const fake = ageDays(
      senderDomainRegisteredAt(`x@${EXEC_LOOKALIKE_DOMAIN}`, NOW),
    )!;
    expect(real).toBeGreaterThan(fake * 100);
  });

  it('returns null rather than inventing a date for an unclassified domain', () => {
    // Guessing here would turn a real signal into noise, and teach learners to trust a
    // number that means nothing.
    expect(
      senderDomainRegisteredAt('x@some-unknown-domain.example', NOW),
    ).toBeNull();
  });

  it('handles a malformed address without throwing', () => {
    expect(senderDomainRegisteredAt('not-an-address', NOW)).toBeNull();
  });

  it('is deterministic — same world clock, same date', () => {
    const a = senderDomainRegisteredAt(`x@${MALICIOUS_DOMAIN}`, NOW);
    const b = senderDomainRegisteredAt(`x@${MALICIOUS_DOMAIN}`, NOW);
    expect(a!.toISOString()).toBe(b!.toISOString());
  });

  it('is case-insensitive on the domain part', () => {
    expect(
      senderDomainRegisteredAt(`x@${MALICIOUS_DOMAIN.toUpperCase()}`, NOW),
    ).not.toBeNull();
  });
});
