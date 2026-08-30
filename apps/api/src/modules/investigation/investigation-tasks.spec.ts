import {
  tasksForCategory,
  ALL_TASK_KEYS,
  type InvestigationTask,
} from './investigation-tasks';
import type { ScenarioCategory } from '@prisma/client';

const ALL_CATEGORIES: ScenarioCategory[] = [
  'identity',
  'endpoint',
  'email',
  'cloud',
  'insider_threat',
  'web',
  'malware',
  'ransomware',
];

function everyTask(): InvestigationTask[] {
  return ALL_CATEGORIES.flatMap((c) => tasksForCategory(c));
}

describe('investigation task checklists', () => {
  it('returns a checklist for every scenario category the catalog can produce', () => {
    for (const category of ALL_CATEGORIES) {
      const tasks = tasksForCategory(category);
      expect(tasks.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('gives every category the same closing discipline: verdict, then proportionate action', () => {
    for (const category of ALL_CATEGORIES) {
      const keys = tasksForCategory(category).map((t) => t.key);
      expect(keys.slice(-2)).toEqual([
        'reach-verdict',
        'recommend-containment',
      ]);
    }
  });

  it('keeps task keys unique within a category, so completion state cannot collide', () => {
    for (const category of ALL_CATEGORIES) {
      const keys = tasksForCategory(category).map((t) => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  // The whole point of the checklist is to teach method. A step that names the finding turns
  // the procedure into an answer key and removes the judgement the exercise exists to build —
  // the same constraint the insight prompts are held to.
  it('never states a conclusion, only an action to take', () => {
    const VERDICT_WORDS =
      /\b(malicious|attack|attacker|compromised|breach|phishing|spoofed|fraudulent|threat actor)\b/i;
    for (const task of everyTask()) {
      expect(`${task.label} ${task.detail}`).not.toMatch(VERDICT_WORDS);
    }
  });

  it('phrases every step as an instruction to go and look, not an observation', () => {
    // Each label should open with a verb the analyst performs.
    const IMPERATIVE =
      /^(Establish|Identify|Check|Look|Determine|Verify|Compare|Assess|Read|Trace|Reach|Recommend|Distinguish|Scope)\b/;
    for (const task of everyTask()) {
      expect(task.label).toMatch(IMPERATIVE);
    }
  });

  it('gives each step a detail explaining why it matters, not just what to do', () => {
    for (const task of everyTask()) {
      expect(task.detail.length).toBeGreaterThan(80);
    }
  });

  it('investigates malware and ransomware with endpoint method', () => {
    const endpoint = tasksForCategory('endpoint').map((t) => t.key);
    expect(tasksForCategory('malware').map((t) => t.key)).toEqual(endpoint);
    expect(tasksForCategory('ransomware').map((t) => t.key)).toEqual(endpoint);
  });

  it('exposes every key any category can produce, for validation on write', () => {
    for (const category of ALL_CATEGORIES) {
      for (const task of tasksForCategory(category)) {
        expect(ALL_TASK_KEYS).toContain(task.key);
      }
    }
  });

  it('tells the email analyst that an empty payload is not the same as a safe email', () => {
    // BEC is the case that breaks a purely technical checklist: no link, no attachment,
    // nothing to detonate. The step has to survive that or it teaches the wrong reflex.
    const payload = tasksForCategory('email').find(
      (t) => t.key === 'assess-payload',
    );
    expect(payload!.detail).toMatch(/not automatically safe/i);
  });

  it('treats "no action" as a legitimate outcome of containment', () => {
    // Two of the scenarios in the library are deliberately not incidents. A checklist that
    // only ever points toward acting would mark the correct answer as incomplete.
    const containment = tasksForCategory('identity').find(
      (t) => t.key === 'recommend-containment',
    );
    expect(containment!.detail).toMatch(/no action at all/i);
  });
});
