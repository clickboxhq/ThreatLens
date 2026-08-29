// Backed by SOCVerse's real GET /threat-intel/mine (apps/api's ThreatIntelHistoryController) —
// every indicator lookup that actually matched something, across every session the Student has
// ever run. Deliberately cannot include indicators the Student never looked up: that endpoint
// only ever surfaces what a real GET /sessions/:id/threat-intel lookup already returned, never
// a scenario's full indicator set (its ground truth).
export type IndicatorType = "hash" | "ip" | "domain" | "url";
export type IndicatorReputation = "malicious" | "suspicious" | "unknown" | "known_good";

export type IocSighting = {
  id: string;
  value: string;
  type: IndicatorType;
  reputation: IndicatorReputation;
  actorAttribution: string | null;
  context: string | null;
  scenarioTitle: string;
  lookedUpAt: string;
};

export type ThreatActor = {
  name: string;
  indicatorCount: number;
  campaigns: number;
  reputation: IndicatorReputation;
};

/** Shared by the Threat Intelligence history page and the in-case lookup panel — one place to
 * keep the reputation→severity mapping consistent. */
export const REPUTATION_SEVERITY: Record<
  IndicatorReputation,
  "critical" | "high" | "medium" | "low"
> = {
  malicious: "critical",
  suspicious: "medium",
  known_good: "low",
  unknown: "low",
};
