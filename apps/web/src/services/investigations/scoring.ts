import type { CaseState, CaseVerdict, ScoreBreakdown } from "@/types/investigations";
import { groundTruth } from "./scoring-data";

const nowStr = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Scoring engine (§12.4) — deterministic, rubric-based. */
export function scoreCase(incidentId: string, c: CaseState, verdict: CaseVerdict): ScoreBreakdown {
  const gt = groundTruth[incidentId];
  const pinned = c.evidence.map((e) => e.eventId);

  if (!gt) {
    return {
      total: 0,
      techniqueAccuracy: 0,
      evidencePrecision: 0,
      evidenceRecall: 0,
      falsePositiveRate: 0,
      responseActions: 0,
      hintPenalty: 0,
      missedEvidence: [],
      noiseIncluded: [],
      missedTechniques: [],
      verdictCorrect: false,
      scoredAt: nowStr(),
    };
  }

  const hits = pinned.filter((id) => gt.evidenceIds.includes(id));
  const noise = pinned.filter((id) => !gt.evidenceIds.includes(id));
  const missed = gt.evidenceIds.filter((id) => !pinned.includes(id));

  const recall = gt.evidenceIds.length ? hits.length / gt.evidenceIds.length : 0;
  const precision = pinned.length ? hits.length / pinned.length : 0;
  const fpRate = pinned.length ? noise.length / pinned.length : 0;

  const techHits = c.techniqueTags.filter((t) => gt.techniques.includes(t));
  const missedTechniques = gt.techniques.filter((t) => !c.techniqueTags.includes(t));
  const techWrong = c.techniqueTags.filter((t) => !gt.techniques.includes(t)).length;
  const techniqueAccuracy = gt.techniques.length
    ? Math.max(0, (techHits.length - techWrong * 0.5) / gt.techniques.length)
    : 0;

  const takenActions = c.actions.map((a) => a.actionId);
  const actionHits = gt.requiredActions.filter((a) => takenActions.includes(a));
  const actionScore = gt.requiredActions.length ? actionHits.length / gt.requiredActions.length : 1;

  const hintPenalty = Math.min(15, c.hintsUsed * 5);
  const verdictCorrect = verdict === gt.verdict;

  const raw =
    techniqueAccuracy * 30 +
    recall * 25 +
    precision * 15 +
    actionScore * 15 +
    (verdictCorrect ? 15 : 0);

  return {
    total: Math.max(0, Math.round(raw - hintPenalty)),
    techniqueAccuracy: Math.round(techniqueAccuracy * 100),
    evidencePrecision: Math.round(precision * 100),
    evidenceRecall: Math.round(recall * 100),
    falsePositiveRate: Math.round(fpRate * 100),
    responseActions: Math.round(actionScore * 100),
    hintPenalty,
    missedEvidence: missed,
    noiseIncluded: noise,
    missedTechniques,
    verdictCorrect,
    scoredAt: nowStr(),
  };
}

/** `gt?.minEvidence ?? 3` fallback used by the submit-validation rule. */
export function getMinEvidence(caseId: string): number {
  return groundTruth[caseId]?.minEvidence ?? 3;
}

/** Reproduces the 3-tier progressive hint text — never exposes the raw record. */
export function getHint(caseId: string, hintsUsed: number): string | undefined {
  const gt = groundTruth[caseId];
  if (!gt || hintsUsed <= 0) return undefined;
  if (hintsUsed === 1)
    return `Focus on the ${gt.techniques[0]} entry point — the earliest event matters.`;
  if (hintsUsed === 2) return `This case involves ${gt.techniques.length} distinct techniques.`;
  return `${gt.evidenceIds.length} events are genuinely relevant; the rest is noise.`;
}

/** Post-submission "what actually happened" narrative. */
export function getNarrative(caseId: string): string | undefined {
  return groundTruth[caseId]?.narrative;
}

export function hasGroundTruth(caseId: string): boolean {
  return Boolean(groundTruth[caseId]);
}
