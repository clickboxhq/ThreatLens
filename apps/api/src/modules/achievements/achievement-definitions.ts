import type { AchievementKey } from '@prisma/client';

// The one input every definition works from: the user's own scored sessions, each carrying
// its own score's aggregate fields (never a raw ground-truth field — see schema.prisma's own
// comment on this boundary) plus which scenario category it was. Re-evaluated against *all*
// of a user's scored sessions every time (not just the one that just finished), so a threshold
// a past session already cleared — before achievements existed, or before a definition changed
// — still gets picked up; the unique(userId, key) constraint makes re-issuing a no-op either way.
export interface ScoredSessionFacts {
  overallPercent: number;
  evidencePrecisionPercent: number;
  techniqueAccuracyPercent: number;
  verdictCorrect: boolean;
  hintPenaltyPercent: number;
  scenarioCategory: string;
}

export interface AchievementDefinition {
  key: AchievementKey;
  title: string;
  description: string;
  isEarned: (sessions: ScoredSessionFacts[]) => boolean;
}

const ALL_CATEGORIES = [
  'identity',
  'endpoint',
  'email',
  'cloud',
  'insider_threat',
  'web',
  'malware',
  'ransomware',
];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: 'first_blood',
    title: 'First Blood',
    description: 'Submit and score your first investigation.',
    isEarned: (sessions) => sessions.length >= 1,
  },
  {
    key: 'perfect_score',
    title: 'Perfect Score',
    description: 'Score 100% overall on an investigation.',
    isEarned: (sessions) => sessions.some((s) => s.overallPercent >= 100),
  },
  {
    key: 'sharpshooter',
    title: 'Sharpshooter',
    description:
      'Pin evidence with 100% precision — nothing you flagged was a false positive.',
    isEarned: (sessions) =>
      sessions.some((s) => s.evidencePrecisionPercent >= 100),
  },
  {
    key: 'technique_master',
    title: 'Technique Master',
    description: 'Tag every MITRE technique correctly on an investigation.',
    isEarned: (sessions) =>
      sessions.some((s) => s.techniqueAccuracyPercent >= 100),
  },
  {
    key: 'verdict_veteran',
    title: 'Verdict Veteran',
    description: 'Reach 5 correct verdicts across all your investigations.',
    isEarned: (sessions) =>
      sessions.filter((s) => s.verdictCorrect).length >= 5,
  },
  {
    key: 'no_hints_needed',
    title: 'No Hints Needed',
    description: 'Close out an investigation without unlocking a single hint.',
    isEarned: (sessions) => sessions.some((s) => s.hintPenaltyPercent === 0),
  },
  {
    key: 'category_explorer',
    title: 'Category Explorer',
    description:
      'Complete at least one investigation in every scenario category.',
    isEarned: (sessions) => {
      const categories = new Set(sessions.map((s) => s.scenarioCategory));
      return ALL_CATEGORIES.every((c) => categories.has(c));
    },
  },
];
