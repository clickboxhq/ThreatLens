import { canonicalJson } from '../../../prisma/canonical-json';

describe('canonicalJson', () => {
  it('treats objects differing only in key order as identical', () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('sorts keys at every depth, not just the top level', () => {
    const x = { outer: { z: 1, a: { n: 2, m: 3 } } };
    const y = { outer: { a: { m: 3, n: 2 }, z: 1 } };
    expect(canonicalJson(x)).toBe(canonicalJson(y));
  });

  // Kill-chain steps and hint ordering carry meaning, so reordering an array is a real change.
  it('keeps array order significant', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('still detects a real value change', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it('ignores undefined, which does not survive a JSONB round-trip', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('handles nulls and nested arrays of objects', () => {
    const a = { k: [{ y: null, x: 1 }] };
    const b = { k: [{ x: 1, y: null }] };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});
