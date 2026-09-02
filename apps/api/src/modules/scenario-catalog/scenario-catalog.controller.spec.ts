import { ScenarioCatalogController } from './scenario-catalog.controller';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * The scenario catalog is reachable by any authenticated student, before they open a session.
 *
 * ScenarioTechnique is populated directly from scoring_rubric.required_techniques, so that
 * list IS the answer key for the technique-accuracy component — 30% of the grade. It was
 * briefly serialised onto the catalog response to support weak-tactic recommendation in the
 * browser, which meant a student could read the answer straight off the endpoint without
 * investigating anything.
 *
 * These tests exist because that regression was easy to introduce, invisible in the UI, and
 * caught only by an external code review. The recommendation now happens server-side.
 */

const SCENARIO = {
  id: 'scenario-1',
  slug: 'bec-wire-transfer-fraud',
  title: 'BEC',
  summary: 'A summary a student is meant to see.',
  category: 'email',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  status: 'published',
  currentVersion: {
    techniques: [
      { mitreTechnique: { techniqueId: 'T1656', tactic: 'TA0001' } },
    ],
  },
};

function buildController() {
  const prisma = {
    attackScenario: {
      findMany: jest.fn().mockResolvedValue([SCENARIO]),
      findUnique: jest.fn().mockResolvedValue(SCENARIO),
    },
    investigationSession: { findMany: jest.fn().mockResolvedValue([]) },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    mitreTechnique: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return new ScenarioCatalogController(prisma);
}

describe('scenario catalog does not leak the scoring answer key', () => {
  it('omits the technique list from the scenario list', async () => {
    const [scenario] = await buildController().list();

    expect(scenario.slug).toBe('bec-wire-transfer-fraud');
    expect('techniqueIds' in scenario).toBe(false);
    // Nothing anywhere in the payload should carry a MITRE id.
    expect(JSON.stringify(scenario)).not.toMatch(/T1\d{3}/);
  });

  it('omits it from the single-scenario endpoint too', async () => {
    const scenario = await buildController().getBySlug(
      'bec-wire-transfer-fraud',
    );

    expect('techniqueIds' in scenario).toBe(false);
    expect(JSON.stringify(scenario)).not.toMatch(/T1\d{3}/);
  });

  it('still returns everything a learner legitimately needs to choose a scenario', async () => {
    // The fix must not gut the catalog — title, summary, category, difficulty and duration
    // are all things a student is meant to browse on.
    const [scenario] = await buildController().list();
    expect(scenario).toMatchObject({
      id: 'scenario-1',
      title: 'BEC',
      summary: 'A summary a student is meant to see.',
      category: 'email',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
    });
  });

  it('recommends nothing until the learner has a scored session to derive weakness from', async () => {
    const controller = buildController();
    const result = await controller.getRecommended({
      id: 'user-1',
    } as never);
    expect(result).toBeNull();
  });
});
