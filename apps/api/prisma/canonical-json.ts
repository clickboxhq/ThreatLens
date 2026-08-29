// ground_truth_definition is JSONB, and Postgres does not preserve object key order — it
// normalizes on write. Comparing a stored definition against the seed literal with a plain
// JSON.stringify therefore reports "changed" on essentially every run, which would publish a
// brand-new scenario version on every deploy. Sorting keys recursively before stringifying
// makes the comparison depend on content alone. Array order is meaningful (kill-chain steps
// are ordered) and is deliberately preserved.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    // undefined disappears through a JSONB round-trip, so treat it as absent on both sides
    // rather than letting it register as a difference.
    if (source[key] === undefined) continue;
    out[key] = sortKeys(source[key]);
  }
  return out;
}
