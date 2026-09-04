/**
 * Derives the facts that docs/ asserts, straight from source.
 *
 * The scenario catalogue and the counts quoted in the platform docs are the sort of thing that
 * is true the day it is written and quietly wrong three commits later. This module is the one
 * place that reads the truth out of the code, so the CI check and the `docs:sync` writer can
 * never disagree about what the truth is.
 *
 * Scenario definitions are inline `seedScenario({ ... })` arguments inside seed.ts's main(),
 * not an importable array, so they are parsed. A parser over source is only dangerous when it
 * fails quietly, so every extraction here asserts what it expected to find and throws
 * otherwise: a seed.ts reformat should break this loudly and get the parser updated, never
 * silently drop scenarios from the docs.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const API_ROOT = join(__dirname, '..');
export const REPO_ROOT = join(API_ROOT, '..', '..');

const read = (relToApi: string) =>
  readFileSync(join(API_ROOT, relToApi), 'utf8').replace(/\r\n/g, '\n');

export interface ScenarioFacts {
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  minutes: number;
  techniques: string[];
  verdict: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  identity: 'Identity',
  email: 'Email',
  endpoint: 'Endpoint',
  malware: 'Malware',
  ransomware: 'Ransomware',
  cloud: 'Cloud',
  web: 'Web application',
  insider_threat: 'Insider threat',
};

// Presentation order for the catalogue: roughly the order a learner meets them.
const CATEGORY_ORDER = [
  'identity',
  'email',
  'endpoint',
  'malware',
  'ransomware',
  'cloud',
  'web',
  'insider_threat',
];

const DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced'];

const VERDICT_LABEL: Record<string, string> = {
  true_positive: 'True positive',
  false_positive: 'False positive',
  benign_positive: 'Benign positive',
};

function fail(what: string): never {
  throw new Error(
    `docs-catalog: ${what}. The shape of prisma/seed.ts has changed — update ` +
      `prisma/docs-catalog.ts to match, then run "npm run docs:sync".`,
  );
}

export function parseScenarios(): ScenarioFacts[] {
  const src = read('prisma/seed.ts');

  // Cross-check: however the definitions are formatted, this is how many there should be.
  const expected = (src.match(/await seedScenario\(/g) ?? []).length;
  if (expected === 0) fail('found no seedScenario() calls');

  const out: ScenarioFacts[] = [];
  for (const chunk of src.split(/\n      slug: '/).slice(1)) {
    const slug = chunk.split("'", 1)[0];

    const pick = (field: string) => {
      const m = chunk.match(new RegExp(`\\n      ${field}:\\s*\\n?\\s*'([^']*)'`));
      return m ? m[1] : null;
    };

    const category = pick('category');
    // Courses and learning paths share the `slug:` shape but carry no category. They are not
    // scenarios and belong in neither the count nor the catalogue.
    if (!category) continue;

    const title = pick('title');
    const difficulty = pick('difficulty');
    const minutes = chunk.match(/\n      estimatedMinutes: (\d+)/);
    const techniques = chunk.match(/requiredTechniques: \[([^\]]*)\]/);
    const verdict = chunk.match(/verdict: '([a-z_]+)'/);

    if (!title) fail(`scenario "${slug}" has no title`);
    if (!difficulty) fail(`scenario "${slug}" has no difficulty`);
    if (!minutes) fail(`scenario "${slug}" has no estimatedMinutes`);
    if (!techniques) fail(`scenario "${slug}" has no requiredTechniques`);
    if (!verdict) fail(`scenario "${slug}" has no expected verdict in its rubric`);
    if (!CATEGORY_LABEL[category]) {
      fail(
        `scenario "${slug}" has category "${category}", which has no label — ` +
          `add it to CATEGORY_LABEL and CATEGORY_ORDER`,
      );
    }
    if (!DIFFICULTY_ORDER.includes(difficulty)) {
      fail(`scenario "${slug}" has unknown difficulty "${difficulty}"`);
    }
    if (!VERDICT_LABEL[verdict[1]]) {
      fail(`scenario "${slug}" has unknown verdict "${verdict[1]}"`);
    }

    const techniqueIds = [...techniques[1].matchAll(/'([^']+)'/g)].map(
      (m) => m[1],
    );
    // The two directions are both real content bugs. A true positive with nothing to tag
    // cannot score its technique component at all — 30% of the grade with no answer key. A
    // non-attack that requires techniques is a contradiction: there is no attack to tag.
    if (verdict[1] === 'true_positive' && techniqueIds.length === 0) {
      fail(`scenario "${slug}" is a true positive but requires no techniques`);
    }
    if (verdict[1] !== 'true_positive' && techniqueIds.length > 0) {
      fail(
        `scenario "${slug}" expects a ${verdict[1]} verdict but requires techniques`,
      );
    }

    out.push({
      slug,
      title,
      category,
      difficulty,
      minutes: Number(minutes[1]),
      techniques: techniqueIds,
      verdict: verdict[1],
    });
  }

  if (out.length !== expected) {
    fail(
      `parsed ${out.length} scenarios but seed.ts makes ${expected} seedScenario() calls`,
    );
  }
  return out;
}

/** The catalogue tables, exactly as they appear between the generated-block markers. */
export function renderScenarioTables(scenarios: ScenarioFacts[]): string {
  const lines: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = scenarios
      .filter((s) => s.category === category)
      .sort(
        (a, b) =>
          DIFFICULTY_ORDER.indexOf(a.difficulty) -
            DIFFICULTY_ORDER.indexOf(b.difficulty) ||
          a.title.localeCompare(b.title),
      );
    if (items.length === 0) continue;

    lines.push(`### ${CATEGORY_LABEL[category]} (${items.length})`, '');
    lines.push(
      '| Scenario | Difficulty | Mins | Correct verdict | Required techniques |',
    );
    lines.push('| --- | --- | ---: | --- | --- |');
    for (const s of items) {
      // A non-attack requires none, and an empty cell reads as missing data rather than as
      // the point.
      const techs = s.techniques.length
        ? s.techniques.map((t) => `\`${t}\``).join(', ')
        : '— *(no attack to tag)*';
      lines.push(
        `| **${s.title}**<br>\`${s.slug}\` | ${s.difficulty} | ${s.minutes} | ${VERDICT_LABEL[s.verdict]} | ${techs} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export interface PlatformFacts {
  scenarioCount: number;
  techniqueCount: number;
  templateCount: number;
  ruleCount: number;
  queueCount: number;
  sessionTtlHours: number;
  telemetryTables: string[];
  weights: Record<string, number>;
  difficultyCounts: Record<string, number>;
}

export function extractPlatformFacts(
  scenarios: ScenarioFacts[],
): PlatformFacts {
  const generator = read('src/modules/telemetry-generator/generator.ts');
  const rules = read('src/modules/alert-engine/rules.ts');
  const queues = read('src/common/queue/queue.module.ts');
  const sessions = read('src/modules/sessions/sessions.service.ts');
  const scorer = read('src/modules/scoring/scorer.ts');
  const schema = read('prisma/schema.prisma');

  const templateCount = (generator.match(/case '/g) ?? []).length;
  const ruleCount = (rules.match(/^export const [A-Z_]+_RULE_NAME/gm) ?? [])
    .length;
  const queueCount = (queues.match(/_QUEUE = '/g) ?? []).length;

  const ttl = sessions.match(/SESSION_TTL_HOURS = (\d+)/);
  if (!ttl) fail('could not find SESSION_TTL_HOURS');

  const weightBlock = scorer.match(/const WEIGHTS = \{([^}]*)\}/);
  if (!weightBlock) fail('could not find the WEIGHTS block in scorer.ts');
  const weights: Record<string, number> = {};
  for (const m of weightBlock[1].matchAll(/(\w+):\s*([0-9.]+)/g)) {
    weights[m[1]] = Number(m[2]);
  }

  // Structural, not by name. A telemetry table is one carrying the ground-truth answer-key
  // column — which is what makes it subject to the DTO boundary. Deriving the list by matching
  // model names like *Event is how http_requests got missed when these docs were first written.
  const telemetryTables: string[] = [];
  for (const m of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    if (!/\n\s+isGroundTruthEvidence /.test(m[2])) continue;
    const mapped = m[2].match(/@@map\("([^"]+)"\)/);
    telemetryTables.push(mapped ? mapped[1] : m[1]);
  }
  if (telemetryTables.length === 0) fail('found no telemetry tables in schema');

  const difficultyCounts: Record<string, number> = {};
  for (const s of scenarios) {
    difficultyCounts[s.difficulty] = (difficultyCounts[s.difficulty] ?? 0) + 1;
  }

  return {
    scenarioCount: scenarios.length,
    techniqueCount: new Set(scenarios.flatMap((s) => s.techniques)).size,
    templateCount,
    ruleCount,
    queueCount,
    sessionTtlHours: Number(ttl[1]),
    telemetryTables: telemetryTables.sort(),
    weights,
    difficultyCounts,
  };
}

export const BEGIN_MARKER = '<!-- BEGIN GENERATED: scenario-tables -->';
export const END_MARKER = '<!-- END GENERATED: scenario-tables -->';

/** Replaces the generated block in a doc's text. Throws if the markers are missing. */
export function replaceGeneratedBlock(doc: string, block: string): string {
  const start = doc.indexOf(BEGIN_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    fail('SCENARIO-CATALOG.md is missing its generated-block markers');
  }
  return (
    doc.slice(0, start + BEGIN_MARKER.length) +
    '\n\n' +
    block +
    '\n\n' +
    doc.slice(end)
  );
}

export function readDoc(name: string): string {
  return readFileSync(join(REPO_ROOT, 'docs', name), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
}

export function extractGeneratedBlock(doc: string): string {
  const start = doc.indexOf(BEGIN_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    fail('SCENARIO-CATALOG.md is missing its generated-block markers');
  }
  return doc.slice(start + BEGIN_MARKER.length, end).trim();
}
