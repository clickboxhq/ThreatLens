# 12. Scenario Engine

## 12.1 Scenario Builder and Ground-Truth Definition Schema

The Scenario Builder is the authoring tool (available to Platform Admins at MVP launch; opened to vetted Instructors in Phase 2, §1.7, §2.15) used to produce a `scenario_versions.ground_truth_definition` (§6.7) JSON document. Its schema, in outline:

```
{
  "metadata": { "category", "difficulty", "estimated_minutes", "narrative_summary" },
  "population": {
    "narrative_identities": [ { "role": "victim|attacker_persona|bystander", "attributes": {...} } ],
    "narrative_devices": [ {...} ],
    "decoy_population_size": { "identities": N, "devices": N },
    "world_time_window_hours": N
  },
  "kill_chain": [
    {
      "step_order": 1,
      "mitre_technique_id": "T1566.001",
      "entity_ref": "victim_identity_1",
      "event_template_id": "phishing_email_generic_invoice_v3",
      "relative_timestamp": "+0h",
      "correlation_group": "phish-chain-1",
      "is_required_for_full_credit": true
    },
    ...
  ],
  "noise_profile": {
    "signal_to_noise_ratio": 0.02,
    "false_positive_bait": [ { "event_template_id": "...", "count": N } ]
  },
  "distractor_pool": [ { "sub_narrative_id": "...", "inclusion_probability": 0.3 } ],
  "scoring_rubric": {
    "required_techniques": [ "T1566.001", "T1204.002", "T1071.001" ],
    "required_verdict": "true_positive",
    "min_evidence_items": 4,
    "containment_expectations": [ { "action": "isolate_device", "target": "victim_device_1", "by_relative_time": "+3h", "weight": 0.15 } ]
  },
  "hints": [ { "unlock_cost_percent": 5, "text": "..." }, ... ]
}
```

Event templates (`event_template_id`) reference the curated, realism-vetted template library maintained by the content team (§7.3) — an author picks *which* templates and *where* they sit in the kill chain, rather than hand-writing raw log rows, which is what keeps scenario authoring throughput reasonably high and keeps every scenario's underlying data realistic by construction. The Scenario Builder UI walks an author through this schema as a guided multi-step form (define narrative → place kill-chain steps on a visual timeline → configure noise/distractors → define rubric → define hints) rather than requiring hand-edited JSON, with the raw JSON view available as an "advanced" tab for power authors.

## 12.2 Difficulty Levels

Difficulty (`beginner`/`intermediate`/`advanced`/`expert`, §6.7) is realized as a bundle of the following authored parameters, not a single knob, so difficulty is meaningfully distinct in *kind* as well as degree:

| Parameter | Beginner | Expert |
|---|---|---|
| Decoy population size | Small (10–20 identities/devices) | Large (100+) |
| Signal-to-noise ratio | Higher (evidence easier to find) | Lower |
| Kill-chain directness | Alerts point close to the answer | Alerts under-cover; more manual pivoting required |
| Distractor sub-narratives | None | 1–3 competing plausible-but-wrong narratives mixed in |
| False-positive bait density | Low | High |
| Hint availability/cost | More hints, lower cost | Fewer hints, higher cost |
| Time pressure (live mode, §12.7) | Off or generous | On, tighter windows |

This structure is what allows the same scenario *category* (e.g., ransomware) to be offered at multiple difficulty tiers as distinct `attack_scenarios` rows without duplicating content-authoring effort from scratch — a common pattern is to author one narrative once and produce a beginner and expert variant by adjusting only the population/noise/distractor parameters around the same fixed kill chain.

## 12.3 Hidden Ground Truth

The `ground_truth_definition`, the `is_ground_truth_evidence`/`is_ground_truth_actor`/`mitre_technique_id` columns on every synthetic entity/event table, and the `seed` are collectively "hidden ground truth" — accessible only to: the Telemetry Generator and Alert Engine (server-side workers, §7–§8), the Scoring Engine (§12.4), and Instructor/Admin-only review endpoints (§2.15, gated by role at the API Gateway and re-checked at the service layer, §15.2). No Student-facing endpoint, WebSocket message, or exported artifact (PDF report, certificate) ever includes these fields; this is enforced structurally by the DTO/serialization layer (§18.3) rather than left to per-endpoint discipline, and is covered by a dedicated automated test suite (§12.6) that fails the build if any Student-facing response schema includes a ground-truth field.

## 12.4 Automated Evaluation (Scoring Engine)

Runs as a background job (`scoring` queue, §5.9) triggered by scenario submission (§2.11), computing the `scores` row (§6.14) via five independently-weighted components (default weights shown; configurable per scenario via `scoring_rubric`, since some categories reasonably weight containment speed higher than others):

1. **Technique accuracy (30%):** overlap between the Student's `incident_techniques` tags and `scenario_techniques.is_required_for_full_credit = true`, penalizing both misses and incorrect additions (precision and recall both matter — tagging every possible technique "just in case" is not free).
2. **Evidence precision/recall (30%):** overlap between `evidence_collection` rows and the underlying `is_ground_truth_evidence = true` rows the Student's `event_id` references point at, computed against `min_evidence_items` and the full ground-truth evidence set.
3. **False-positive handling (15%):** correctly dismissed `is_false_positive_by_design` alerts (§8.6) with a substantive (non-empty, minimum-length) dismissal reason score positively; escalating them into an incident or pinning them as evidence scores negatively.
4. **Response/containment (15%):** `investigation_actions` compared against `containment_expectations` — was the right action taken, against the right target, within the expected relative-time window.
5. **Verdict correctness (10%):** did `incidents.verdict` match `scoring_rubric.required_verdict`.

The overall percentage is the weighted sum; the full itemized breakdown (not just the final number) is stored in `scores.rubric_breakdown` and is what the results screen (§2.12) renders, because showing *only* a final percentage would undermine the platform's core pedagogical premise — a Student needs to see specifically which evidence they missed and which technique tags were wrong to actually learn from an attempt, not just know they scored 61%.

## 12.5 Hints

Each scenario's `hints` array (§12.1) is an ordered, incrementally-revealing set of nudges (e.g., hint 1: "Check this identity's recent sign-in activity"; hint 2 references a specific alert; hint 3 references a specific technique). Requesting a hint is recorded as an `investigation_actions` row and applies `hint_penalty_percent` (§6.14) to the final score, deducted proportionally to the hint's authored `unlock_cost_percent` — this makes hints a legitimate, always-available strategy (never gated behind a paywall or limited count, since discouraging a stuck Student from getting unstuck at all would hurt retention far more than a modest score deduction) rather than a rare emergency-only feature.

## 12.6 Instructor Override and Scenario Versioning

Instructor override of a *finished session's grading* is covered in §2.15/§6.20 (`instructor_feedback`) — additive, never destructive to the automated score. Instructor override of the *scenario content itself* (for Instructor-authored custom scenarios, §1.7 Phase 2) follows the same `scenario_versions` append-only model as Platform Admin-authored content (§6.7): editing a published scenario creates a new `scenario_versions` row; `attack_scenarios.current_version_id` only repoints after the new version passes an automated **scenario validation pipeline** — a required pre-publish check verifying: every `required_technique` in the rubric has at least one corresponding kill-chain step, every referenced `event_template_id` exists, no Student-facing field path in the generated output schema contains a ground-truth field (§12.3's automated test, run per-scenario at publish time in addition to the platform-wide test suite), and a smoke-test session can be generated, alerted, and scored end-to-end without error. A scenario failing validation cannot be published, protecting both content quality and the "the backend always knows the answer" guarantee (§1.2) from author error.

## 12.7 Randomization and Live/Time-Phased Mode

Per-session randomization mechanics are specified in §7.5 (population/timestamp/noise variation) and §12.2 (distractor sub-narrative inclusion). **Live/time-phased mode** (`scenario_versions.ground_truth_definition.metadata` flag, referenced in §8.4) is an authoring option where alerts and evidence are released to the Student incrementally against `investigation_sessions.current_scenario_time` (§6.9) rather than all at once — driven by a scheduled advancement of `current_scenario_time` (a background job ticking the session's simulated clock forward at a configurable rate, e.g., 1 simulated hour per 2 real minutes) pushed to the client over WebSocket (§5.10). This mode is reserved for `advanced`/`expert` scenarios specifically designed around response-time pressure (e.g., ransomware-in-progress narratives, §1.8) — it is not the default mode, since forcing time pressure onto every scenario would undermine the reflective, self-paced learning experience that suits most of the platform's use cases (§1.4).
