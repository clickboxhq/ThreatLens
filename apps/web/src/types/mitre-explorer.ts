import type { MitreTechnique } from "./telemetry";

export type MitreCoverage = { tactic: string; cov: number };
export type MitreMastery = { tactic: string; mastery: number; practiced: number; total: number };
export type PracticedTechnique = MitreTechnique & { mastery: number; practicedCount: number };
