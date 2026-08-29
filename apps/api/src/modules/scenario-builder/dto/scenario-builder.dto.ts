import {
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import type {
  ScenarioCategory,
  ScenarioDifficulty,
  IncidentVerdict,
} from '@prisma/client';

// The authored ground-truth-definition shape a scenario author submits. Validated by hand in
// ScenarioBuilderService rather than nested class-validator decorators (this codebase's existing
// pattern for a free-form nested object — see SubmitInstructorFeedbackDto's `rubricOverrides` —
// is a plain `@IsObject()` here plus real structural validation in the service, since the cross-
// field rules involved — entity refs resolving, techniques existing, required techniques
// actually appearing in the kill chain — aren't expressible as per-field decorators anyway).
export interface AuthoredNarrativeIdentity {
  ref: string;
  department: string;
  job_title: string;
  home_country: string;
}

export interface AuthoredNarrativeDevice {
  ref: string;
  hostname: string;
  os_platform: string;
}

export interface AuthoredKillChainStep {
  step_order: number;
  mitre_technique_id: string;
  entity_ref: string;
  device_ref?: string;
  event_template_id: string;
  relative_timestamp: string;
  correlation_group: string;
  is_required_for_full_credit: boolean;
}

export interface AuthoredFalsePositiveBait {
  event_template_id: string;
  count: number;
  device_ref?: string;
}

export interface AuthoredHint {
  unlock_cost_percent: number;
  text: string;
}

export interface AuthoredGroundTruthDefinition {
  metadata?: { narrative_summary?: string };
  population: {
    narrative_identities: AuthoredNarrativeIdentity[];
    narrative_devices: AuthoredNarrativeDevice[];
    decoy_population_size: { identities: number; devices: number };
    world_time_window_hours: number;
  };
  kill_chain: AuthoredKillChainStep[];
  noise_profile: {
    signal_to_noise_ratio?: number;
    false_positive_bait: AuthoredFalsePositiveBait[];
  };
  scoring_rubric: {
    required_techniques: string[];
    required_verdict: IncidentVerdict;
    min_evidence_items: number;
  };
  hints: AuthoredHint[];
}

const SCENARIO_CATEGORIES: ScenarioCategory[] = [
  'identity',
  'endpoint',
  'email',
  'cloud',
  'insider_threat',
  'web',
  'malware',
  'ransomware',
];

const SCENARIO_DIFFICULTIES: ScenarioDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

export class ValidateScenarioDraftDto {
  @IsObject()
  groundTruthDefinition!: AuthoredGroundTruthDefinition;
}

export class CreateScenarioDto {
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, kebab-case (e.g. "new-attack-scenario").',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  summary!: string;

  @IsIn(SCENARIO_CATEGORIES)
  category!: ScenarioCategory;

  @IsIn(SCENARIO_DIFFICULTIES)
  difficulty!: ScenarioDifficulty;

  @IsInt()
  @Min(1)
  estimatedMinutes!: number;

  @IsObject()
  groundTruthDefinition!: AuthoredGroundTruthDefinition;
}
