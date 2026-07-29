// Deterministic PRNG (mulberry32) so a session's telemetry can be exactly reproduced
// from its stored `seed` for debugging/instructor QA (§6.9, §7.2).
export class SeededRng {
  private state: number;

  constructor(seed: bigint) {
    // Fold the BigInt seed down to a 32-bit state.
    this.state = Number(seed % 4294967296n) >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.intBetween(0, items.length - 1)];
  }
}
