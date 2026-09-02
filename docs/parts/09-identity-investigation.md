# 9. Identity Investigation Service

## 9.1 Purpose

The Identity Portal is ThreatLens's proprietary analog to an Entra ID-style identity investigation surface (§1.6) — it is where a Student investigates *who* was involved in an incident: sign-in behavior, risk signals, group membership, and device associations. It is backed entirely by the `identities` and related tables in §6.10 and the `sign_in_events`/`conditional_access_evaluations` tables in §6.12.1, scoped to the active `session_id`.

## 9.2 Identity Directory (List View)

Searchable/filterable list of every `identities` row in the session (decoy and narrative-relevant alike — the Student never sees the internal `is_ground_truth_actor` flag, §6.10). Columns: display name, department, risk level, MFA status, account status. Filters: risk level, department, MFA status, "has risky sign-ins" toggle. This view intentionally surfaces the full decoy population (§7.2) so that finding the *right* identity to focus on is part of the investigative task, not a pre-filtered given.

## 9.3 Identity Profile

Per-identity detail page assembling:
- **Overview panel:** name, UPN, department, job title, manager (linked to the manager's own profile via `manager_identity_id`), account status, MFA status, risk level.
- **Devices panel:** all `devices` where `primary_identity_id` matches, or where a `sign_in_events` row links this identity to that device — cross-links directly into the Device Portal (§10).
- **Group membership panel:** from `identity_group_memberships`, flagging `role_assignable` groups distinctly since privileged-group membership is frequently narrative-relevant.
- **Conditional Access panel:** `conditional_access_evaluations` rows for this identity, showing policy name, result, and reasons — this is where a Student sees *why* a sign-in was granted, blocked, or challenged for MFA, mirroring the investigative value of a real CA evaluation log.
- **Password History (simulated):** a synthetic, non-reversible history of password-change *events* (`password_changed_at`, `changed_by` — self or admin-reset, `reason` if flagged) — modeled as metadata only; **no actual password values, hashes, or anything resembling real credential material are ever stored or displayed for synthetic identities**, both because it adds no investigative value and to avoid any pattern that could be mistaken for real-credential handling guidance.

## 9.4 Sign-in Timeline

The core investigative surface of the Identity Portal: a chronological list of every `sign_in_events` row for this identity, each rendered with source IP, geo (country/city), application, result, legacy-auth flag, and a computed "distance from previous sign-in" annotation used for impossible-travel reasoning. Filterable by result (success/failure/blocked) and by a "risky only" toggle that surfaces sign-ins the Alert Engine (§8.2) flagged.

## 9.5 Risky Sign-ins

A dedicated filtered view (not a separate table — computed by joining `sign_in_events` against alerts whose `primary_entity_id` is this identity and whose `detection_rules` category is identity-related, §8.2) surfacing exactly the sign-ins that triggered identity-category detections, with the specific triggering rule named — giving the Student a starting point without doing their investigation for them (they still must determine relevance/severity themselves).

## 9.6 Impossible Travel Detection (Investigative Surface)

The Alert Engine's impossible-travel rule (§8.2) computes great-circle distance between consecutive sign-in geo-points for the same identity and flags pairs whose implied travel speed exceeds a realistic threshold (default: exceeds commercial-flight-speed feasibility with a configurable buffer for VPN/mobile-network geo-imprecision, tunable per scenario to control difficulty — a tighter buffer surfaces more borderline cases). The Identity Profile visually pairs flagged sign-in events (e.g., a "previous sign-in" reference chip) so a Student can see both ends of the anomalous pair without manually cross-referencing timestamps by hand, while still requiring them to judge severity and write the justification themselves.

## 9.7 Password Spray Detection (Investigative Surface)

Surfaced at the *source-IP* level rather than per-identity: the Search feature (§2.8) and a dedicated "Authentication Investigation" cross-identity view let a Student query "all failed sign-ins from source IP X" to discover the fan-out across many identities that characterizes spraying — the Alert Engine's password-spray rule (§8.2) pre-flags the pattern as an alert, but confirming which specific identities were targeted and whether any succeeded (indicating a compromised account requiring escalation) is manual investigative work using this cross-identity query capability.

## 9.8 Geo-location and Behavior Timeline

Every sign-in's `source_country`/`source_city` is rendered on a simple map/list visualization in the profile (no external mapping API call — city/country-to-coordinate lookup uses a small bundled static reference dataset, keeping this dependency-free per §7.6's no-runtime-external-call principle). The "Behavior Timeline" referenced in the product brief is realized as the same chronological Sign-in Timeline (§9.4) combined with any `investigation_actions` (§6.13) the Student themselves has taken against this identity (e.g., "you disabled this account at 14:32") rendered inline, so the identity's own timeline and the Student's response actions are visible together.

## 9.9 What Is Never Exposed to the Student

Per §6.10/§6.12, the following columns are stripped by the API-layer DTO mapping (§16) before any Identity Portal response leaves the service, regardless of role (even Instructor Mode's "review" view uses a separate, explicitly-ground-truth-aware endpoint, §2.15, gated to instructor/admin roles only): `is_ground_truth_actor`, `is_ground_truth_evidence`, `mitre_technique_id` on event rows, and the internal `seed`/`ground_truth_definition` of the owning session/scenario. This separation is enforced by a dedicated response-serialization layer (§18.3), not by convention alone, since a leaked ground-truth flag would trivially break the assessment validity of every scenario built on that data.
