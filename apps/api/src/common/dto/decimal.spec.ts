import { Prisma } from '@prisma/client';
import { toNumber } from './decimal';

describe('toNumber (Decimal -> JSON number)', () => {
  it('converts a Decimal to a real number, not a string', () => {
    const result = toNumber(new Prisma.Decimal('85.00'));
    expect(typeof result).toBe('number');
    expect(result).toBe(85);
  });

  // The actual production failure: a Decimal survives JSON.stringify as a quoted string, so
  // `sum + value` in the client concatenates instead of adding. This is the assertion that
  // would have caught "AVERAGE SCORE 186172%" before it shipped.
  it('survives JSON serialisation as a number, so client arithmetic adds', () => {
    const wire = JSON.parse(
      JSON.stringify({ overallPercent: toNumber(new Prisma.Decimal('55.00')) }),
    ) as { overallPercent: number };

    expect(typeof wire.overallPercent).toBe('number');
    expect(wire.overallPercent + 10).toBe(65);
  });

  it('demonstrates the raw Decimal is what broke it', () => {
    const raw = JSON.parse(
      JSON.stringify({ overallPercent: new Prisma.Decimal('55.00') }),
    ) as { overallPercent: unknown };
    expect(typeof raw.overallPercent).toBe('string');
  });

  it('passes null through — an unscored session has no percentage', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });

  it('keeps fractional precision', () => {
    expect(toNumber(new Prisma.Decimal('72.55'))).toBe(72.55);
  });
});
