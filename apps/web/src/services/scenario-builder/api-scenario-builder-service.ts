import { apiClient } from "@/lib/api-client";
import type { ScenarioBuilderService } from "./scenario-builder-service";
import type {
  EventTemplateDto,
  ScenarioDraft,
  CreatedScenarioDto,
} from "@/types/socverse-scenario-builder";

/** Renders "+Nh" or "+NhMm" — the exact shape the Telemetry Generator's
 * parseRelativeTimestamp() requires; anything else silently generates at time zero. */
function relativeTimestamp(hours: number, minutes: number): string {
  return minutes > 0 ? `+${hours}h${minutes}m` : `+${hours}h`;
}

/** Converts the builder's camelCase draft into the real API's snake_case
 * ground-truth-definition shape (apps/api's AuthoredGroundTruthDefinition). */
function toGroundTruthDefinition(draft: ScenarioDraft) {
  return {
    metadata: draft.narrativeSummary ? { narrative_summary: draft.narrativeSummary } : undefined,
    population: {
      // `attributes` is a real nested wrapper the generator's own interface requires
      // (narrative.attributes.department, not a flattened narrative.department) — not a
      // flattening convenience, so it has to round-trip through the wire shape unchanged.
      narrative_identities: draft.identities.map((i) => ({
        ref: i.ref,
        attributes: {
          department: i.department,
          job_title: i.jobTitle,
          home_country: i.homeCountry,
        },
      })),
      narrative_devices: draft.devices.map((d) => ({
        ref: d.ref,
        attributes: {
          hostname: d.hostname,
          os_platform: d.osPlatform,
        },
      })),
      decoy_population_size: {
        identities: draft.decoyIdentities,
        devices: draft.decoyDevices,
      },
      world_time_window_hours: draft.worldTimeWindowHours,
    },
    kill_chain: draft.killChain.map((s) => ({
      step_order: s.stepOrder,
      mitre_technique_id: s.mitreTechniqueId,
      entity_ref: s.entityRef,
      device_ref: s.deviceRef || undefined,
      event_template_id: s.eventTemplateId,
      relative_timestamp: relativeTimestamp(s.timestampHours, s.timestampMinutes),
      correlation_group: s.correlationGroup,
      is_required_for_full_credit: s.isRequiredForFullCredit,
    })),
    noise_profile: {
      signal_to_noise_ratio: draft.signalToNoiseRatio,
      false_positive_bait: draft.falsePositiveBait.map((b) => ({
        event_template_id: b.eventTemplateId,
        count: b.count,
        device_ref: b.deviceRef || undefined,
      })),
    },
    scoring_rubric: {
      required_techniques: draft.requiredTechniqueIds,
      required_verdict: draft.requiredVerdict,
      min_evidence_items: draft.minEvidenceItems,
    },
    hints: draft.hints.map((h) => ({
      unlock_cost_percent: h.unlockCostPercent,
      text: h.text,
    })),
  };
}

export const apiScenarioBuilderService: ScenarioBuilderService = {
  listTemplates: () => apiClient.get<EventTemplateDto[]>("/scenario-builder/templates"),

  validateDraft: (draft) =>
    apiClient.post<{ valid: boolean; errors: string[] }>("/scenario-builder/validate", {
      groundTruthDefinition: toGroundTruthDefinition(draft),
    }),

  publishDraft: (draft) =>
    apiClient.post<CreatedScenarioDto>("/scenario-builder/scenarios", {
      slug: draft.slug,
      title: draft.title,
      summary: draft.summary,
      category: draft.category,
      difficulty: draft.difficulty,
      estimatedMinutes: draft.estimatedMinutes,
      groundTruthDefinition: toGroundTruthDefinition(draft),
    }),
};
