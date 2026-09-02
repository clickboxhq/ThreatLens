// Matches SOCVerse's real scenario-builder API (apps/api/src/modules/scenario-builder) — net
// new in Phase 6 of the merge plan. A scenario is authored by *composing* the fixed catalog of
// real event templates the Telemetry Generator can render (EVENT_TEMPLATES on the API side) into
// a new kill chain — never by inventing a template id that doesn't already exist there.

export type EventPortal = "identity" | "endpoint" | "email" | "cloud" | "network" | "web";

export interface EventTemplateDto {
  id: string;
  label: string;
  portal: EventPortal;
  requiresDevice: boolean;
  suggestedTechniqueIds: string[];
  isNoiseOnly: boolean;
}

export const SCENARIO_CATEGORIES = [
  "identity",
  "endpoint",
  "email",
  "cloud",
  "insider_threat",
  "web",
  "malware",
  "ransomware",
] as const;

export const SCENARIO_DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;

/** The only 5 home-country codes the generator's city/coordinate lookup recognizes. */
export const NARRATIVE_HOME_COUNTRIES = ["US", "CA", "GB", "DE", "AU"] as const;

export const NARRATIVE_OS_PLATFORMS = ["windows", "linux"] as const;

export const REQUIRED_VERDICTS = ["true_positive", "false_positive", "benign_positive"] as const;

export interface NarrativeIdentityDraft {
  ref: string;
  department: string;
  jobTitle: string;
  homeCountry: string;
}

export interface NarrativeDeviceDraft {
  ref: string;
  hostname: string;
  osPlatform: string;
}

export interface KillChainStepDraft {
  stepOrder: number;
  mitreTechniqueId: string;
  entityRef: string;
  deviceRef: string;
  eventTemplateId: string;
  timestampHours: number;
  timestampMinutes: number;
  correlationGroup: string;
  isRequiredForFullCredit: boolean;
}

export interface FalsePositiveBaitDraft {
  eventTemplateId: string;
  count: number;
  deviceRef: string;
}

export interface HintDraft {
  unlockCostPercent: number;
  text: string;
}

export interface ScenarioDraft {
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  narrativeSummary: string;
  identities: NarrativeIdentityDraft[];
  devices: NarrativeDeviceDraft[];
  decoyIdentities: number;
  decoyDevices: number;
  worldTimeWindowHours: number;
  killChain: KillChainStepDraft[];
  signalToNoiseRatio: number;
  falsePositiveBait: FalsePositiveBaitDraft[];
  requiredTechniqueIds: string[];
  requiredVerdict: string;
  minEvidenceItems: number;
  hints: HintDraft[];
}

export interface CreatedScenarioDto {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
}
