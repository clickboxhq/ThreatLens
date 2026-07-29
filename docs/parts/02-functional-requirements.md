# 2. Functional Requirements

This section enumerates every user-facing feature at MVP scope, its purpose, its primary actors, and its acceptance criteria at a level detailed enough to derive UI wireframes and API contracts from. Deeper technical treatment of each feature's backend service lives in §8–§14 and §18; deeper UI treatment lives in §17.

Actors used throughout this document:
- **Student** — a learner working scenarios, either self-enrolled or assigned by an instructor.
- **Instructor** — creates/assigns scenarios, reviews student work, issues feedback and overrides.
- **Org Admin** — manages an institutional/enterprise tenant: seats, SSO, billing, reporting.
- **Platform Admin** — SOCVerse operator staff; manages scenario library, global config, support.
- **System** — automated actors: Telemetry Generator, Alert Engine, Scoring Engine.

## 2.1 Alert Dashboard

**Purpose:** The first screen a Student sees when a scenario session begins; mirrors the "alerts queue" of a real SIEM/XDR console. Presents all alerts the Alert Engine (§8) has generated for the active `investigation_session`.

**Requirements:**
- List view with columns: severity, title, entity (identity/device/mailbox), MITRE technique tag(s), status (New / In Progress / Resolved / Dismissed), first-seen timestamp, alert count if deduplicated (§8.7).
- Filter/sort by severity, status, entity type, technique, time range.
- Clicking an alert opens the Incident/Alert detail view, showing the raw evidence that triggered it (the specific `security_events` rows referenced by the alert's `alert_evidence_refs`) and a "Promote to Incident" or "Add to Incident" action.
- Bulk actions: assign multiple alerts to a new or existing incident, bulk-dismiss with a required dismissal reason (feeds §8.9 false-positive tracking and scoring).
- Real-time updates via WebSocket (§5) as the Telemetry/Alert Engine emits new alerts mid-session for scenarios with a time-phased narrative (§12.7).

**Acceptance criteria:** A Student can, without instructor help, understand which alerts exist, drill into the evidence behind any one alert, and either dismiss it or escalate it into a case, all without leaving the dashboard route.

## 2.2 Incident Queue

**Purpose:** Case-manager-style list of `incidents` — the unit of work a Student is actually graded on (an alert is raw signal; an incident is the Student's claim about what happened).

**Requirements:**
- List of incidents in the current session with status (Open / Investigating / Contained / Closed), severity, assigned analyst (self, in solo mode), linked alert count, linked entity count, SLA/time-in-status indicator.
- Create incident manually (Student-initiated) or via "Promote to Incident" from the Alert Dashboard.
- Incident detail view aggregates: linked alerts, linked entities (identities/devices/mailboxes), the Global Timeline scoped to this incident, Analyst Notes, Evidence Collection items, and the final Verdict submission form (§2.12).

**Acceptance criteria:** A Student can build a single incident out of multiple related alerts (e.g., a risky sign-in alert + a malware-execution alert on the device that signed in), and the platform persists that grouping distinctly from the underlying alerts.

## 2.3 Case Management

**Purpose:** The workspace for a single incident's lifecycle: status transitions, ownership, SLA tracking, and closure workflow (verdict + classification + MITRE technique tagging + final report).

**Requirements:**
- Status state machine: `Open → Investigating → Contained → Closed` with `Reopened` as a valid transition from `Closed`. Each transition is timestamped and stored in `investigation_actions` for scoring/replay (§6.13, §2.20).
- Closure requires: a verdict (True Positive / False Positive / Benign Positive), a written summary (free text, minimum length enforced), and technique tags selected from `mitre_techniques`.
- Instructor override capability (§2.15): an instructor can reopen, re-classify, or annotate a closed case without altering the Student's original submission (stored as a separate `instructor_feedback` record, §6.20).

**Acceptance criteria:** Case status and verdict are immutable once submitted except via an explicit, audited instructor reopen action.

## 2.4 Identity Portal

Full detail in §9. Functional summary: searchable directory of `identities` in the active scenario; per-identity profile with risk level, MFA status, group membership, manager, devices, and a sign-in timeline with geo/risk annotations (impossible travel, password spray correlation) rendered as investigable evidence, not simply displayed as an answer key.

## 2.5 Device Portal

Full detail in §10. Functional summary: searchable directory of `devices`; per-device profile with process tree, installed software, network connections, file timeline, registry changes (Windows-flavored scenarios), USB activity, and isolation action (a scorable containment action, §2.20).

## 2.6 Email Portal

Full detail in §11. Functional summary: mailbox/message search; message reader with raw header view, SPF/DKIM/DMARC results, attachment and URL analysis panels, and campaign correlation across other messages in the same scenario dataset.

## 2.7 Threat Intelligence

**Purpose:** A proprietary, scenario-scoped threat intel lookup surface, avoiding any dependency on real external TI feeds (which would leak real-world answers or introduce non-reproducible results).

**Requirements:**
- `threat_intel_indicators` table (§6) seeded per-scenario with IOCs (hashes, IPs, domains, URLs) that are relevant to that scenario's ground truth, plus deliberate decoy/benign indicators to avoid trivial keyword-matching solutions.
- Lookup panel accessible from Device Portal (file hash), Email Portal (URL/domain), and a standalone search page.
- Each indicator carries a synthetic "reputation" (Malicious / Suspicious / Unknown / Known-good), a synthetic actor/campaign attribution where relevant, and free-text context — modeled on the information density of a real TI platform response, without querying any live external service.

**Acceptance criteria:** Every IOC a Student needs to resolve a scenario is resolvable via this in-platform lookup; no scenario ever requires an external internet lookup.

## 2.8 Search

**Purpose:** Cross-entity keyword and structured search scoped to the active session's synthetic dataset — the SOCVerse analog of a SIEM search bar, deliberately simplified (§1.6).

**Requirements:**
- Structured filter builder (field = value, with AND) covering the common investigable fields (source IP, user, device, process name, file hash, URL, sender) across `security_events`.
- Freetext search over event raw fields.
- Results are timestamped, entity-tagged, and each result can be added directly to Evidence Collection (§2.10) or the Global Timeline (§2.9) with one action.

**Acceptance criteria:** Search never requires knowledge of a proprietary query language beyond field=value pairs; results appear in under 500ms P95 for a session-scoped dataset (§3.1).

## 2.9 Global Timeline

**Purpose:** A unified, chronologically sorted view of every event a Student has pulled in as relevant (from Search, Identity Portal, Device Portal, Email Portal), used to visually reconstruct the attack chain.

**Requirements:**
- Drag-free, click-to-add model: any evidence item, anywhere in the product, has an "Add to Timeline" action.
- Timeline view groups by entity/lane (per-identity, per-device, per-mailbox swimlanes) with cross-entity correlation lines where the platform can determine two events share a session/correlation ID (§6.9).
- Exportable as part of the final incident report (§2.12).

**Acceptance criteria:** A Student can construct an ordered narrative of the incident purely from items they've curated onto the timeline, and that curated set is itself part of what the Scoring Engine evaluates (did they include the right events; did they include noise).

## 2.10 Evidence Collection

**Purpose:** A scoped "evidence locker" per incident — distinct from the Timeline (which is about *order*) in that Evidence Collection is about *relevance/proof*.

**Requirements:**
- Any record (event, alert, identity attribute, device artifact, email) can be pinned to Evidence Collection with an analyst-written justification note.
- Evidence items are individually taggable to a specific MITRE technique.
- Evidence Collection is a required, scored input to the final incident report (§2.12, §12.4).

## 2.11 Scenario Completion

**Purpose:** The end-state flow when a Student submits a final verdict on an incident (or set of incidents) tied to a `scenario`.

**Requirements:**
- Submission requires: verdict, technique tags, written summary, and a minimum evidence-collection count (configurable per scenario).
- On submission, session locks (no further evidence changes) and is handed to the Scoring Engine (§12.4) for immediate automated scoring, with a results screen showing score breakdown, missed evidence, and false positives flagged.
- Optional "Request Instructor Review" flag for cohort-assigned scenarios, queuing it in the Instructor Mode review list (§2.15).

## 2.12 Scoring

Full detail in §12.4 and §6 (`scores`, `investigation_sessions`). Functional summary: composite score built from technique-identification accuracy, evidence precision/recall, false-positive rate, hint usage penalty, and time-to-resolution, displayed as an overall percentage plus a rubric breakdown, never as an opaque single number alone.

## 2.13 Analyst Notes

**Purpose:** Freeform, timestamped note-taking scoped to an incident, for the Student's own working memory — not directly graded, but retained and visible to instructors and to the Student in their own review/replay.

**Requirements:** Rich-text (constrained: bold/italic/lists/code-inline only — no arbitrary HTML) notes, autosaved, versioned by timestamp, visible in the incident detail sidebar at all times.

## 2.14 Evidence Collection (Reporting Output)

Covered by §2.10/§2.11; the "final report" artifact assembled from Notes + Evidence Collection + Timeline + Verdict is rendered as a structured document (HTML in-app, exportable to PDF) — see §2.19 Reporting.

## 2.15 Instructor Mode

**Purpose:** Enables the B2B/education commercial motion (§1.7 Phase 2).

**Requirements:**
- Class/cohort creation and roster management (invite by email or join code).
- Scenario assignment to a cohort with a due date and attempt limit.
- Live review queue: submitted sessions awaiting instructor sign-off, with side-by-side view of Student evidence trail vs. ground truth.
- Instructor Feedback: free-text + rubric-item overrides, stored distinctly from the automated score (`instructor_feedback` table, §6.20) so automated and human assessment are both preserved.
- Gradebook export (CSV) per cohort per scenario.
- Instructor-authored scenario creation entry point (delegates to Scenario Builder, §12.1), gated to Instructor/Admin roles.

## 2.16 Admin Portal

**Purpose:** Org Admin and Platform Admin operations surface, separate application shell from the Student/Instructor experience (§17.1).

**Requirements (Org Admin scope):** seat management, SSO configuration, billing/plan view, usage reporting across the org's cohorts.
**Requirements (Platform Admin scope):** scenario library management (publish/unpublish/version), global user search and support actions (impersonation with full audit logging, §15.10), platform-wide analytics (§2.17), feature flag configuration, incident-response tooling for the platform itself (not to be confused with in-scenario incidents).

## 2.17 Analytics

**Purpose:** Both learner-facing progress analytics and org/platform-facing usage analytics.

**Requirements:**
- Student-facing: per-skill radar/trend (accuracy by MITRE tactic over time), scenario completion history, time-on-task trends, leaderboard position (§13.5).
- Org-facing: cohort completion rates, average score by scenario, time-to-completion distributions, skill-gap heatmap across a cohort (which techniques does this cohort systematically miss).
- Platform-facing: DAU/MAU, funnel from signup → first scenario completion → subscription conversion, scenario-level difficulty calibration data (is a scenario's real-world pass rate matching its authored difficulty label) feeding back into §12.1.

## 2.18 Certificates

**Purpose:** Shareable proof of completion for learning paths (§13.6) and, longer-term, the proctored certification product (§1.7 Phase 3).

**Requirements:** Auto-issued PDF/verifiable-link certificate on learning-path completion meeting a minimum score threshold; unique verification URL (`/verify/{certificate_uuid}`) that renders a public, minimal-PII confirmation page.

## 2.19 Reporting

**Purpose:** Structured incident report generation (Student-facing, per §2.11/§2.14) and org-facing usage/compliance reporting (Admin-facing, per §2.16/§2.17), both exportable as PDF/CSV.

## 2.20 Investigation Actions (cross-cutting)

Certain in-product actions are themselves scorable "response" behaviors, not just information-gathering: **Isolate Device**, **Disable Account/Force Password Reset**, **Block Sender/Domain**, **Escalate to Incident**, **Dismiss Alert (with reason)**. Every such action is recorded in `investigation_actions` (§6.13) with actor, timestamp, and target entity, both to support the Global Timeline/replay feature and because a scenario's rubric may require (or penalize) specific containment actions (e.g., "did the Student isolate the compromised host before or after further lateral movement occurred in the simulated timeline").
