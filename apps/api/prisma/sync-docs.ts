/**
 * Rewrites the generated blocks in docs/ from source. Run after changing seed.ts:
 *
 *   npm run docs:sync
 *
 * The paired spec (src/common/docs/docs-in-sync.spec.ts) fails CI when the committed docs and
 * source disagree, so this is the command that failure tells you to run.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  parseScenarios,
  renderScenarioTables,
  replaceGeneratedBlock,
  readDoc,
  REPO_ROOT,
} from './docs-catalog';

const scenarios = parseScenarios();
const updated = replaceGeneratedBlock(
  readDoc('SCENARIO-CATALOG.md'),
  renderScenarioTables(scenarios),
);
writeFileSync(join(REPO_ROOT, 'docs', 'SCENARIO-CATALOG.md'), updated, 'utf8');
console.log(`docs/SCENARIO-CATALOG.md synced from ${scenarios.length} scenarios.`);
