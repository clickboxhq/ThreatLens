export type MitreCoverage = { tactic: string; cov: number };

// Backed by SOCVerse's real GET /sessions/skill-radar and GET /sessions/technique-mastery —
// a per-tactic / per-technique required-vs-tagged rollup across the Student's own scored
// sessions. A tactic/technique never required by any scored session is omitted entirely (it's
// "no data yet," not "0% mastery").
export type MitreMastery = { tactic: string; mastery: number; practiced: number; total: number };
export type PracticedTechnique = {
  id: string;
  name: string;
  tactic: string;
  mastery: number;
  practicedCount: number;
};
