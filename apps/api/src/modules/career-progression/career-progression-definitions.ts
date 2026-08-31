import type { CareerLevel } from '@prisma/client';

// Same shape and same reasoning as achievements' ScoredSessionFacts: derived purely from a
// user's own scored sessions, re-evaluated against *all* of them every time rather than just
// the one that just finished, so a threshold a past session already cleared (before career
// progression existed, or before a threshold changed) still gets picked up.
export interface CareerSessionFacts {
  overallPercent: number;
  hintPenaltyPercent: number;
  scenarioCategory: string;
}

export interface CareerLevelThreshold {
  level: CareerLevel;
  title: string;
  /** What has to be true of the user's scored-session history to reach this level. */
  isReached: (sessions: CareerSessionFacts[]) => boolean;
  /** One line per requirement, shown on My Progress so a Student can see exactly what's left. */
  requirements: { label: string; met: (sessions: CareerSessionFacts[]) => boolean }[];
}

function categoryCount(sessions: CareerSessionFacts[]): number {
  return new Set(sessions.map((s) => s.scenarioCategory)).size;
}

function averagePercent(sessions: CareerSessionFacts[]): number {
  if (sessions.length === 0) return 0;
  return sessions.reduce((sum, s) => sum + s.overallPercent, 0) / sessions.length;
}

function hintIndependenceRate(sessions: CareerSessionFacts[]): number {
  if (sessions.length === 0) return 0;
  return sessions.filter((s) => s.hintPenaltyPercent === 0).length / sessions.length;
}

// Ordered l1 -> l2 -> senior — checkAndPromote below only ever advances one step at a time from
// the user's *current* level, same "re-check but only move forward" spirit as the rest of the
// scoring-chain triggers. Thresholds are deliberately modest at l1->l2 (this is meant to be
// reachable within a normal first week of practice) and real at l2->senior (this is what the
// guided/independent investigation mode gates on — see investigation-checklist.tsx).
export const CAREER_LEVEL_THRESHOLDS: CareerLevelThreshold[] = [
  {
    level: 'l2',
    title: 'SOC Analyst II',
    isReached: (sessions) =>
      sessions.length >= 5 && averagePercent(sessions) >= 70 && categoryCount(sessions) >= 3,
    requirements: [
      { label: '5 scored investigations', met: (s) => s.length >= 5 },
      { label: '70% average score', met: (s) => averagePercent(s) >= 70 },
      { label: '3 different scenario categories', met: (s) => categoryCount(s) >= 3 },
    ],
  },
  {
    level: 'senior',
    title: 'Senior SOC Analyst',
    isReached: (sessions) =>
      sessions.length >= 15 &&
      averagePercent(sessions) >= 85 &&
      categoryCount(sessions) >= 6 &&
      hintIndependenceRate(sessions) >= 0.5,
    requirements: [
      { label: '15 scored investigations', met: (s) => s.length >= 15 },
      { label: '85% average score', met: (s) => averagePercent(s) >= 85 },
      { label: '6 different scenario categories', met: (s) => categoryCount(s) >= 6 },
      {
        label: 'At least half your investigations closed without a hint',
        met: (s) => hintIndependenceRate(s) >= 0.5,
      },
    ],
  },
];

const LEVEL_ORDER: CareerLevel[] = ['l1', 'l2', 'senior'];

/** The one level directly above `current`, or null at the top of the ladder. */
export function nextLevel(current: CareerLevel): CareerLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

/**
 * Whether `current` should be promoted, given the user's full scored-session history. Only
 * ever proposes one step up — a user who has technically cleared the senior bar while still
 * flagged l1 gets promoted to l2 first, then senior on the next check, so nothing silently
 * skips the level a Student would actually see in their own history.
 */
export function nextEarnedLevel(
  current: CareerLevel,
  sessions: CareerSessionFacts[],
): CareerLevel | null {
  const target = nextLevel(current);
  if (!target) return null;
  const threshold = CAREER_LEVEL_THRESHOLDS.find((t) => t.level === target);
  if (!threshold) return null;
  return threshold.isReached(sessions) ? target : null;
}
