import {
  parseScenarios,
  renderScenarioTables,
  extractPlatformFacts,
  extractGeneratedBlock,
  readDoc,
} from '../../../prisma/docs-catalog';

/**
 * Fails when docs/ and the code disagree.
 *
 * The as-built docs quote real numbers — how many scenarios, templates, rules and telemetry
 * tables there are, what the scoring weights are. Every one of those was true when written and
 * every one of them is a thing somebody will change without opening a markdown file. A
 * reference document that is quietly wrong is worse than no reference at all, because it is
 * still believed.
 *
 * When this fails: run `npm run docs:sync` for the catalogue tables, or edit the prose for a
 * changed count. Both are the point — the failure is the reminder, not an obstacle.
 */
describe('docs are in sync with the code', () => {
  const scenarios = parseScenarios();
  const facts = extractPlatformFacts(scenarios);

  describe('scenario catalogue', () => {
    it('matches what seed.ts defines', () => {
      const committed = extractGeneratedBlock(readDoc('SCENARIO-CATALOG.md'));
      const expected = renderScenarioTables(scenarios);

      // Rendered rather than diffed field-by-field so the failure message is the actual
      // markdown, which makes "what changed" obvious without re-running the generator.
      expect(committed).toBe(expected);
    });

    it('lists every scenario exactly once', () => {
      const slugs = scenarios.map((s) => s.slug);
      expect(new Set(slugs).size).toBe(slugs.length);

      const doc = readDoc('SCENARIO-CATALOG.md');
      for (const slug of slugs) {
        expect(doc).toContain(`\`${slug}\``);
      }
    });

    it('names the scenarios whose correct verdict is not an attack', () => {
      // These three are the reason the platform can teach "not everything that alerts is an
      // attack". If one is renamed or dropped, the prose explaining them goes stale silently.
      const notAttacks = scenarios.filter((s) => s.verdict !== 'true_positive');
      expect(notAttacks.length).toBeGreaterThan(0);

      const doc = readDoc('SCENARIO-CATALOG.md');
      for (const s of notAttacks) {
        expect(doc).toContain(s.slug);
      }
    });
  });

  describe('counts quoted in prose', () => {
    const platform = () => readDoc('PLATFORM.md');
    const events = () => readDoc('EVENT-CATALOG.md');
    const index = () => readDoc('README.md');

    const WORDS: Record<string, number> = {
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };

    /**
     * Reads a count out of prose, accepting either "8" or "eight".
     *
     * Matching the exact sentence would make the docs hostage to the test — "Three BullMQ
     * queues" reads better than "3 BullMQ queues", and a check that forces the numeral makes
     * the writing worse to satisfy a regex. What must not drift is the number itself, so this
     * pins the value and leaves the wording free. A missing match still fails: the sentence
     * disappearing is drift too.
     */
    const countIn = (doc: string, re: RegExp): number | null => {
      const m = doc.match(re);
      if (!m) return null;
      const raw = m[1].toLowerCase();
      return /^\d+$/.test(raw) ? Number(raw) : (WORDS[raw] ?? null);
    };

    it('scenario count', () => {
      expect(scenarios.length).toBeGreaterThan(0);
      for (const doc of [platform(), events(), index()]) {
        // Only assert where the doc actually quotes it, but if it quotes a number it must be
        // this one.
        const quoted = doc.match(/(\d+) scenarios/);
        if (quoted) expect(Number(quoted[1])).toBe(scenarios.length);
      }
    });

    it('event template count', () => {
      expect(countIn(events(), /(\w+) templates in/)).toBe(facts.templateCount);
      expect(countIn(index(), /(\w+) event templates/)).toBe(
        facts.templateCount,
      );
    });

    it('detection rule count', () => {
      expect(countIn(events(), /(\w+) rules in/)).toBe(facts.ruleCount);
      expect(countIn(index(), /(\w+) detection rules/)).toBe(facts.ruleCount);
    });

    it('telemetry table count, derived structurally not by model name', () => {
      // http_requests carries the ground-truth columns but is not named *Event, which is
      // exactly how it was missed the first time these docs were written.
      expect(countIn(events(), /## The (\w+) telemetry tables/)).toBe(
        facts.telemetryTables.length,
      );
    });

    it('every telemetry table appears in the event catalogue', () => {
      const doc = events();
      for (const table of facts.telemetryTables) {
        expect(doc).toContain(`\`${table}\``);
      }
    });

    it('MITRE technique count', () => {
      expect(readDoc('SCENARIO-CATALOG.md')).toContain(
        `${facts.techniqueCount} distinct ATT&CK techniques`,
      );
    });

    it('difficulty split', () => {
      const doc = readDoc('SCENARIO-CATALOG.md');
      for (const [level, count] of Object.entries(facts.difficultyCounts)) {
        const row = new RegExp(
          `\\| ${level[0].toUpperCase()}${level.slice(1)} \\| (\\d+) \\|`,
        );
        const m = doc.match(row);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBe(count);
      }
    });

    it('session TTL', () => {
      expect(countIn(platform(), /expire (\w+) hours/)).toBe(
        facts.sessionTtlHours,
      );
    });

    it('queue count', () => {
      expect(countIn(platform(), /(\w+) BullMQ queues/)).toBe(facts.queueCount);
    });

    it('scoring weights', () => {
      const doc = platform();
      const asPercent = (w: number) => `${Math.round(w * 100)}%`;
      for (const weight of Object.values(facts.weights)) {
        expect(doc).toContain(asPercent(weight));
      }
      // The weights must still add up, in the code as well as the table.
      const total = Object.values(facts.weights).reduce((a, b) => a + b, 0);
      expect(Math.round(total * 100)).toBe(100);
    });
  });
});
