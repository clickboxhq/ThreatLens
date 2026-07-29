# 8. Alert Engine

## 8.1 Purpose and Detection Model

The Alert Engine consumes the telemetry a session's Telemetry Generator run produced (§7) and materializes the `alerts` (§6.15) a Student actually sees on the Alert Dashboard (§2.1). It is deliberately **not** a general-purpose, user-authorable detection-rules engine (that would make SOCVerse a SIEM-authoring product, contradicting §1.6) — it is a fixed library of proprietary `detection_rules` (§6.15), each an internally-implemented function (not a Student-facing query language) that evaluates a specific, well-understood detection pattern against a session's event tables and emits an alert when the pattern matches.

Because the Telemetry Generator already knows and flags every ground-truth-evidence event (`is_ground_truth_evidence`, §6.12) and every intentional noise/false-positive-bait event, the Alert Engine's rule library is authored to be **behaviorally realistic** — a rule fires because a real analytic pattern is present in the data (an impossible-travel geo/time delta, a rare parent-child process pairing, an SPF-fail-plus-lookalike-domain combination) — rather than simply "fire an alert on every `is_ground_truth_evidence` row." This distinction matters pedagogically: it means alerts sometimes fire on noise (realistic false positives, §8.6) and some ground-truth evidence is deliberately **sub-alert-threshold** (discoverable only through manual investigation, not handed to the Student by an alert), which is what makes the Search, Global Timeline, and manual pivoting features (§2.8–§2.9) genuinely necessary rather than decorative.

## 8.2 Rule Categories

The MVP rule library covers, at minimum, one or more concrete rules per attack category in §1.8:

| Category | Example rules |
|---|---|
| Identity | impossible travel (geo-distance/time-delta threshold), password spray (N failed sign-ins across M distinct identities from one source within a window), MFA fatigue (repeated MFA prompts followed by an approval), legacy-auth sign-in from a risky location, sign-in from a newly-seen ASN/country for that identity |
| Endpoint | rare parent-child process pairing (e.g., `winword.exe` → `powershell.exe`), known-LOLBin invocation with suspicious command-line flags, new persistence artifact (registry Run key / scheduled task creation outside a maintenance window), mass file-modify-then-rename matching a ransomware pattern, USB mass-storage connect followed by high-volume file copy |
| Email | SPF/DKIM/DMARC failure combined with a display-name/domain lookalike, first-time-sender-to-org plus urgency-language subject heuristic (matched against an authored keyword/pattern list, not live NLP inference, §8.1), known-malicious attachment hash/URL match against `threat_intel_indicators` |
| Network/C2 | periodic beaconing interval detection (regular inter-request timing to one external host), DNS query volume/entropy anomaly (DGA-style domain pattern), connection to a `threat_intel_indicators`-listed IP/domain |
| Cloud | anomalous control-plane action from a non-baseline location/identity, storage resource made public, new access key created for a privileged identity outside baseline behavior |
| Privilege escalation / lateral movement | sign-in to an unusual number of distinct devices in a short window by one identity, privileged-group membership change, use of a service account interactively |

Each rule is implemented as a scoped SQL/query-layer function operating only against the triggering session's own tables (never cross-session), executed by the Alert Engine worker (§5.9) once telemetry generation for that session completes.

## 8.3 Correlation Logic

Beyond single-event rules, a smaller set of **correlation rules** operate over the `correlation_id` links the Telemetry Generator stitched in (§7.2 stage 4): if two-plus individually-triggering conditions share a `correlation_id` (e.g., a risky sign-in and a subsequent mass file-encryption event on a device that sign-in accessed), the Alert Engine emits them as **linked alerts** (a `related_alert_id` self-reference on `alerts`, surfaced in the UI as "related alerts" on the alert detail view) rather than fully independent items — modeling how real SOC tooling nudges an analyst toward recognizing one incident instead of N unrelated alerts, without pre-building the incident for the Student (that synthesis remains their graded task, §2.2).

## 8.4 Alert Generation Timing

For standard (non-live-mode) sessions, all alerts for the full simulated time window are generated in one batch immediately after telemetry generation completes, queued as `alert-correlation` (§5.9), chained after the `telemetry-generation` job via the queue's job-dependency feature so a session never shows a Student a partially-alerted, inconsistent state. For **live/time-phased** scenarios (§12.7), the Alert Engine still evaluates the full dataset up front but *releases* alerts to the Student incrementally, matched to `current_scenario_time` (§6.9) as it advances, pushed over the WebSocket channel (§4.4, §5.10) — this supports scenarios designed to be worked in real time (e.g., "you have 30 simulated minutes before the ransomware detonates") without requiring a second, separate detection implementation.

## 8.5 Severity Assignment

Each `detection_rules` row carries a `default_severity`; the Alert Engine may adjust severity per-instance using simple, documented modifiers (e.g., +1 severity tier if the primary entity `is_privileged`, §6.10) so severity is not purely static per rule type — mirroring how real detection content commonly weights privileged-account activity higher. Severity directly informs default Alert Dashboard sort order (§2.1) but never gates alert visibility — every generated alert is visible to the Student regardless of severity, since under-triaging low-severity alerts is itself a realistic and gradable failure mode.

## 8.6 False Positives (By Design)

A configurable subset of rules are permitted to fire on `is_ground_truth_evidence = false` (noise) events when the underlying pattern genuinely matches — these are marked `is_false_positive_by_design = true` (§6.15) at generation time and are the direct mechanism behind the false-positive-handling component of scoring (§6.14, §12.4: correctly dismissing these, with a substantive dismissal reason, is rewarded; escalating them into an incident is penalized). This is authored deliberately per scenario (the content team chooses which noise events are "realistic enough to trip a rule") rather than being an accidental/uncontrolled side effect of the rule logic, keeping false-positive rate a tunable difficulty and pedagogical parameter rather than a data-quality bug.

## 8.7 Deduplication and Suppression

- **Deduplication:** repeated instances of the same rule firing for the same primary entity within a configurable rolling window (e.g., 10 failed sign-ins each individually matching a "failed sign-in" pattern) are collapsed into a single `alerts` row with `dedup_count` incremented and `last_seen_at` extended, rather than flooding the queue with near-duplicate alerts — mirroring standard SIEM alert-fatigue mitigation and keeping the Alert Dashboard realistically sized (tens, not thousands, of alerts per session even at high event volume, §7.4).
- **Suppression:** an authored per-scenario suppression list can mark specific known-benign patterns (e.g., a scheduled backup job's routine large network transfer) as fully suppressed (never surfaced as an alert at all, though still present and searchable in raw telemetry) — used sparingly, and only where the content team judges that surfacing it as a dismissible alert would add tedium rather than pedagogical value; the default is to let a realistic false positive appear and be dismissed (§8.6), not to suppress it.

## 8.8 Alert Prioritization on the Dashboard

Default sort is severity descending, then recency descending, matching common SIEM/XDR triage-queue conventions so the ergonomic transfer (§1.6) holds; Students may re-sort/filter freely (§2.1). No proprietary "risk score" ranking algorithm beyond severity + recency is introduced at MVP — keeping the prioritization model transparent and explainable is itself pedagogically important (a Student should be able to reason about *why* something is prioritized, not trust an opaque score), and is revisited only if usage data shows Students need finer-grained triage guidance at higher difficulty tiers.
