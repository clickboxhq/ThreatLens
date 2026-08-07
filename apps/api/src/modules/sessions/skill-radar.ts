// §2.17/§13.2: a per-MITRE-tactic proficiency rollup across a Student's own scored sessions
// ("am I weak on Credential Access vs Lateral Movement"), not just a per-session breakdown.
// Deliberately re-derives required-vs-tagged from the same two sources scoring.service.ts
// already reads (ScenarioVersion.groundTruthDefinition's rubric, IncidentTechnique join rows)
// rather than parsing Score.rubricBreakdown's `missedTechniques` JSON — that field only ever
// captured the miss side and never carried a tactic, so it's not a stable source for this.

export interface SessionTechniqueOutcome {
  requiredTechniqueIds: string[];
  taggedTechniqueIds: string[];
}

export interface SkillRadarEntry {
  tactic: string;
  tacticName: string;
  requiredCount: number;
  hitCount: number;
  percent: number;
}

// The standard MITRE ATT&CK Enterprise tactic set — kept complete (not trimmed to only the
// tactics this scenario library currently uses) so a newly-authored scenario touching a
// not-yet-seen tactic doesn't need a matching update here.
const TACTIC_NAMES: Record<string, string> = {
  TA0043: 'Reconnaissance',
  TA0042: 'Resource Development',
  TA0001: 'Initial Access',
  TA0002: 'Execution',
  TA0003: 'Persistence',
  TA0004: 'Privilege Escalation',
  TA0005: 'Defense Evasion',
  TA0006: 'Credential Access',
  TA0007: 'Discovery',
  TA0008: 'Lateral Movement',
  TA0009: 'Collection',
  TA0011: 'Command and Control',
  TA0010: 'Exfiltration',
  TA0040: 'Impact',
};

// Canonical kill-chain order, so the radar's axes read the way an attack actually unfolds
// (left-to-right / around the circle) instead of an arbitrary or alphabetical order.
const TACTIC_ORDER = Object.keys(TACTIC_NAMES);

/**
 * Pure aggregation: for each scored session, a required technique counts once toward that
 * tactic's denominator; it also counts toward the numerator if the Student tagged it on a
 * closed incident in that session. A tactic with zero required-technique instances across
 * every scored session is omitted entirely — an untested tactic isn't "0% proficiency," it's
 * simply no data yet, and showing it as a zeroed-out axis would misrepresent that.
 */
export function computeSkillRadar(
  sessions: SessionTechniqueOutcome[],
  tacticByTechniqueId: Map<string, string>,
): SkillRadarEntry[] {
  const requiredCountByTactic = new Map<string, number>();
  const hitCountByTactic = new Map<string, number>();

  for (const session of sessions) {
    const taggedSet = new Set(session.taggedTechniqueIds);
    for (const techniqueId of session.requiredTechniqueIds) {
      const tactic = tacticByTechniqueId.get(techniqueId);
      if (!tactic) continue;
      requiredCountByTactic.set(tactic, (requiredCountByTactic.get(tactic) ?? 0) + 1);
      if (taggedSet.has(techniqueId)) {
        hitCountByTactic.set(tactic, (hitCountByTactic.get(tactic) ?? 0) + 1);
      }
    }
  }

  return TACTIC_ORDER.filter((tactic) => requiredCountByTactic.has(tactic)).map((tactic) => {
    const requiredCount = requiredCountByTactic.get(tactic)!;
    const hitCount = hitCountByTactic.get(tactic) ?? 0;
    return {
      tactic,
      tacticName: TACTIC_NAMES[tactic] ?? tactic,
      requiredCount,
      hitCount,
      percent: Math.round((hitCount / requiredCount) * 1000) / 10,
    };
  });
}
