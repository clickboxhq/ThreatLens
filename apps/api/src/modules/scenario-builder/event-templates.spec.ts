import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEVICE_REQUIRED_TEMPLATE_IDS,
  EVENT_TEMPLATE_IDS,
  EVENT_TEMPLATES,
} from './event-templates';

/**
 * The template catalogue is what the Scenario Builder validates against, and the generator's
 * switch is what actually renders a template. They are two hand-maintained lists of the same
 * thing. A template in the switch but not the catalogue cannot be authored; one in the
 * catalogue but not the switch passes validation and then silently generates nothing for that
 * step — a scenario whose kill chain has a hole in it that no error ever reports.
 */
describe('event template catalogue', () => {
  const generatorSource = readFileSync(
    join(__dirname, '../telemetry-generator/generator.ts'),
    'utf8',
  );
  const rendered = new Set(
    [...generatorSource.matchAll(/^ {4}case '([a-z0-9_]+)':/gm)].map(
      (m) => m[1],
    ),
  );

  it('lists exactly the templates the generator can render', () => {
    expect([...EVENT_TEMPLATE_IDS].sort()).toEqual([...rendered].sort());
  });

  it('has no duplicate ids', () => {
    expect(EVENT_TEMPLATE_IDS.size).toBe(EVENT_TEMPLATES.length);
  });

  it('marks a template device-scoped exactly when its generator case needs a device', () => {
    // Each device-scoped case opens with `if (!ctx.device) break;` — without a device it
    // renders nothing, so the builder must demand a device_ref for it.
    for (const id of rendered) {
      const start = generatorSource.indexOf(`    case '${id}':`);
      const next = generatorSource.indexOf('\n    case ', start + 1);
      const body = generatorSource.slice(start, next === -1 ? undefined : next);
      const needsDevice = /if \(!ctx\.device\) break;/.test(body);
      expect({ id, needsDevice }).toEqual({
        id,
        needsDevice: DEVICE_REQUIRED_TEMPLATE_IDS.has(id),
      });
    }
  });
});
