# ThreatLens — Backend Integration Guide

**Status: 100% mock/localStorage. Zero backend, zero real auth, zero real database.**

This document is the frontend's contract with a future backend. It is **not** a finished API spec — it's what the frontend currently needs and assumes, written down so the backend can be designed against real requirements instead of guesses. Every "Proposed endpoint" below is exactly that: proposed. Change shapes freely: the frontend's job is to swap `services/<domain>/index.ts`'s one export line from `mock*Service` to `api*Service` per domain, not to dictate your schema.

## How the frontend is structured today

```
UI (routes/components)
   ↓
Feature hooks (src/hooks/use-*.ts)
   ↓
Service interface (src/services/<domain>/<domain>-service.ts)
   ↓
Mock adapter (implemented today) ──┬── API adapter (stub, throws NotConnectedError until connected)
                                     ↓
                              Zustand store (src/lib/store.ts, localStorage)
                              or static in-memory data
```

- **Group A domains** (backed by the Zustand store, mutable): Alerts, Incidents, Investigations, Endpoints, Identities, Scenarios, Timeline, Account/Onboarding, Email. Their hooks read the store reactively (`useSoc((s) => s.alerts)`); mutations go through the service.
- **Group B domains** (read-only reference/query data): everything else. Their hooks wrap `@tanstack/react-query`, so `state: 'loading'|'error'|'empty'|'ready'` is already derived and rendered via `WorkspacePage`'s skeleton/empty-state support.
- Cutover mechanism, every domain, identical: open `src/services/<domain>/index.ts` and change one line from the mock export to the API export. No hook or route needs to change.

---

## Feature → Data → Mutation → Backend Needed → Current Adapter

| Route | Domain | Reads | Writes | Backend needed | Adapter |
|---|---|---|---|---|---|
| `/app` | DashboardPerformance | KPIs, performance trend, recent investigations, assigned scenarios | — | Yes | Mock |
| `/app/alerts` | Alerts | Alert list | Status/assign/resolve/escalate/note/dismiss/promote | Yes | Mock |
| `/app/incidents` | Incidents | Incident list | Status/note | Yes | Mock |
| `/app/cases` | Incidents | Incident list (as case files) | — | Yes | Mock |
| `/app/cases/$id` | Investigations + Scoring | Case state, telemetry, MITRE list, response actions, hints, narrative | Pin/unpin/tag evidence, timeline add/remove, notes, technique tags, summary, hint reveal, submit verdict, reopen | **Yes — highest priority** | Mock |
| `/app/identity` | Identities | Identity list | — | Yes | Mock |
| `/app/endpoints` | Endpoints | Endpoint list | Isolate/restore | Yes | Mock |
| `/app/email` | EmailInvestigations | Message list | — | Optional (illustrative) | Mock |
| `/app/threat-intel` | ThreatIntel | Threat actors, IOCs | — | Optional | Mock |
| `/app/scenarios` | Scenarios | Scenario list, progress | Set progress | Yes | Mock |
| `/app/learning` | LearningCenter | Tracks, achievements, certificates | — | Yes | Mock |
| `/app/certificates` | Certificates | Certificate list | — | Yes | Mock |
| `/app/analytics` | Analytics | Time-series, MITRE coverage | — | Yes | Mock |
| `/app/reports` | Reports | Report list | Generate (not implemented) | Yes | Mock |
| `/app/instructor` | Instructor | Cohort summaries | — | Yes | Mock |
| `/app/organizations` | Organizations + Account | Member list, account name | Account type/name | Yes | Mock |
| `/app/settings` | Settings | Sections, toggles, regions | Toggle/select (not implemented) | Yes | Mock |
| `/app/profile` | Profile + Certificates | Summary, skill mastery, certificates | — | Yes | Mock |
| `/app/timeline` | Timeline + Account | Global timeline events, case count | Reset session | Yes | Mock |
| `/app/scoring` (marketing) | n/a | — | — | n/a | n/a |
| `/app/settings` → Billing tab | Billing | Summary, invoices, seat utilization | Upgrade/cancel (not implemented) | Yes | Mock |
| `/app/billing` | Billing | Summary, invoices, seat utilization | — | Yes | Mock |
| `/app/mitre` | MitreExplorer | Mastery, per-technique practice | — | Yes | Mock |
| `/app/leaderboard` | Leaderboard | Ranked analysts | — | Yes | Mock |
| `/app/achievements` | Achievements | Badge list | — | Yes | Mock |
| `/app/audit-logs` | AuditLogs | Entries, stats, categories | — | Yes | Mock |
| `/app/cohorts` | Cohorts | Cohort list, stats, track completion | — | Yes | Mock |
| `/app/feedback` | Feedback | Instructor feedback entries | — | Yes | Mock |
| `/app/assessments` | Assessments | Assessment list, stats, grading breakdown | — | Yes | Mock |
| `/app/scenario-builder` | ScenarioBuilder | Event sources, draft timeline, config, validation | Add event/publish (not implemented) | Yes | Mock |
| `/app/search` | Search | Categories, top results | — | Yes | Mock |
| `/app/student-analytics` | StudentAnalytics | Student rows, stats, failure modes | — | Yes | Mock |
| `/app/evidence` | EvidenceLocker | Artifacts, stats, coverage, grading impact | — | Yes | Mock |
| Topbar bell | Notifications | Notification list, unread count | Mark read / mark all read | Yes | Mock |
| `/reset-password/$token` | Auth (none yet) | Token validity | Set new password | Yes (real auth) | Mock-only token status |
| `/verify-email/$token` | Auth (none yet) | Token validity | — | Yes (real auth) | Mock-only token status |
| `/accept-invite/$token` | Auth (none yet) + Account | Invite validity, inviting org | Accept invite | Yes (real auth) | Mock-only token status |
| `/verify/$id` | Certificates | Single certificate by ID | — | Yes | Mock |
| Command palette (⌘K) | Alerts, Identities, Endpoints, Scenarios | Composed from the above | — | (covered above) | Mock |

---

## Domain reference

### Investigations (the core loop — highest priority)

**Frontend needs**: the full lifecycle of a case — telemetry search, evidence pinning, timeline curation, technique tagging, notes, hints, verdict submission, and a rubric-based score.

**Queries**
- `searchTelemetry(query: string)` — freetext or `field=value` filter (`entity=`, `source=`, `mitre=`) over a scenario's security events
- `eventById(id)`
- `listMitreTechniques()`, `listResponseActions()`, `listDismissalReasons()`
- `getMinEvidence(caseId)`, `getHint(caseId, hintsUsed)`, `getNarrative(caseId)` — **these must never return the raw ground-truth record.** The current mock computes them from a private module (`scoring-data.ts`) that no route imports directly.

**Mutations**
- `setCaseStatus`, `pinEvidence`, `unpinEvidence`, `tagEvidence`, `addToTimeline`, `removeFromTimeline`, `addCaseNote`, `toggleTechniqueTag`, `setCaseSummary`, `useHint`, `logAction`, `submitCase(id, verdict)`, `reopenCase(id, feedback)`

**Proposed endpoints**
```
GET  /investigations/:id
GET  /investigations/:id/telemetry?query=...
POST /investigations/:id/evidence           { eventId, justification }
DELETE /investigations/:id/evidence/:eventId
POST /investigations/:id/timeline           { eventId }
DELETE /investigations/:id/timeline/:eventId
POST /investigations/:id/notes              { body }
POST /investigations/:id/hints              → { hint: string }
POST /investigations/:id/verdict            { verdict, summary, techniqueTags }
                                             → { score: ScoreBreakdown }  (computed server-side)
POST /investigations/:id/reopen             { feedback }
```

**Error states**: validation (missing verdict, summary < 80 chars, no technique tags, insufficient evidence — currently enforced client-side for UX but must be re-validated server-side), not-found, conflict (already submitted), forbidden (not your case / case not reopened).

**Permissions**: individual/organization members can only act on their own cases; reopening is instructor/admin-only.

**Pagination/filtering**: telemetry search is currently client-side over ~18 events; at scale this must become a server-side paginated/filtered query (by entity, source, mitre, date range, severity).

**Trust boundary — the one domain where cutover is not just a URL change**: today, `scoreCase()` runs in the browser against a `groundTruth` object that ships in the client bundle (unavoidable without a server — moving it to a "service" file doesn't hide the bytes, it only stops route components from importing it directly). **The real backend must own scoring entirely server-side and must never send the ground-truth record to the client, before or after submission** — only the derived score, hints, and post-submission narrative. `getHint`/`getMinEvidence`/`getNarrative` must become real network calls that a server decides how much to reveal on, not client-side reads of a local object.

### Alerts / Incidents / Endpoints / Identities / Scenarios

Standard CRUD-ish domains already shaped as services (`src/services/{alerts,incidents,endpoints,identities,scenarios}`). Queries are `list*()`; mutations mirror today's Zustand actions 1:1 (e.g. `setAlertStatus`, `assignAlert`, `toggleIsolate`, `setProgress`). Proposed: `GET /alerts`, `PATCH /alerts/:id`, `POST /alerts/:id/notes`, and equivalents per domain. Permissions: read scoped to the caller's org/individual context; mutations require analyst role or above. Pagination: alerts/identities/endpoints should be server-paginated and filterable (severity, status, source, analyst, time range) well before real data volume — the UI already has filter-button placeholders wired to nothing.

### Timeline

`eventsFor(ids)` resolves curated event ids to full events. Proposed: `GET /timeline?caseIds=...` or a joined query — this is currently a pure client-side lookup against the same telemetry the Investigations domain uses, so it likely shouldn't be a separate backend concept at all, just a view over Investigations data.

### Account / Onboarding

`setAccountType`, `completeOnboarding`, `resetSession`. This is where real auth changes everything: `accountType`/`accountName`/`onboardingCompleted` are client-side/localStorage only today. Once real auth exists, these become server-owned session/user-profile fields, not local toggles — `resetSession` in particular (a "wipe my demo data" button) has no real-world equivalent and should be removed once accounts are real.

### Organizations / Cohorts / Instructor / StudentAnalytics / Assessments / Feedback

The organization-training cluster. All currently static lists. Real endpoints need: member invite/remove/role-change (`Organizations`), cohort CRUD + roster management (`Cohorts`), per-cohort instructor views (`Instructor`), per-student performance (`StudentAnalytics`), scheduled/graded assessments (`Assessments`), and per-investigation instructor feedback (`Feedback`) — this last one should probably be a field on Investigations (`instructorFeedback`), not a separate resource, matching what `CaseState.instructorFeedback` already models.

### Scoring-adjacent read views: Leaderboard, MitreExplorer, DashboardPerformance, Analytics, Profile

All derive from the same underlying scored-investigation data (leaderboard ranks scores, MitreExplorer aggregates technique mastery, DashboardPerformance composes Leaderboard + MitreExplorer + its own KPIs, Profile shows one user's slice). **These should be backend-computed aggregates, not client-side derivations** — several of today's mock values are explicitly fabricated per-row formulas (`58 + (i*13) % 40` for mastery, `88 - i*2` for leaderboard accuracy) that only existed because there was no real scoring history to aggregate. Once Investigations scoring is real, these four domains become read replicas/materialized views over it.

### ScenarioBuilder

Instructor authoring surface: event sources, draft timeline, scenario config (difficulty, randomization, grading rubric, hints, time limit), validation messages. Proposed: `POST /scenarios`, `PUT /scenarios/:id`, `POST /scenarios/:id/validate`, `POST /scenarios/:id/publish`, `POST /scenarios/:id/archive`. This is the domain that ultimately produces the `groundTruth` records Investigations/Scoring consumes — its output must land directly in the server-side scoring store, never round-trip through the client.

### Certificates / Achievements / LearningCenter

Read-only reward/progress domains. Real backend needs event-driven writes (a certificate is issued when a track completes; an achievement unlocks when a condition is met) but the frontend only ever needs to read the current state — no mutations are currently exposed here beyond what Investigations submission would trigger server-side.

### AuditLogs / Settings / Billing

Platform-admin domains, currently fully static. AuditLogs should be an append-only, backend-owned log the frontend only paginates/filters (never writes to directly). Settings toggles and Billing upgrade/cancel are UI-only today — no mutation currently reaches a service method that does anything; wiring these is real future work, not a gap in this pass.

### EvidenceLocker / Search / ThreatIntel / EmailInvestigations

Reference/lookup domains. EvidenceLocker is conceptually adjacent to Investigations' evidence (chain-of-custody metadata) but modeled separately today since the UI treats it as a cross-case artifact log, not per-case state — worth reconciling with the backend team whether these should merge. Search composes across nearly every other domain (today: static categories + static top results) — a real implementation is a cross-domain query, not its own data store. ThreatIntel and EmailInvestigations are the most clearly "someday" domains — illustrative content with no mutations at all.

### Notifications (new)

**Frontend needs**: a per-user notification feed driving the Topbar bell — category, title, body, timestamp, read state, optional deep link.

**Queries**: `listNotifications()`. **Mutations**: `markAsRead(id)`, `markAllAsRead()`.

**Proposed endpoints**
```
GET  /notifications                      → paginated, newest first
POST /notifications/:id/read
POST /notifications/read-all
```
A real backend should push these (websocket/SSE) rather than have the client poll — the current mock is a static list with no live-update simulation. **Permissions**: strictly scoped to the authenticated user; never return another user's notifications. **Pagination**: required at scale — the mock returns all 6 at once. Categories map 1:1 to `NotificationCategory` in `src/types/notifications.ts`.

### Auth pages (`reset-password`, `verify-email`, `accept-invite`)

These three routes exist today as UI shells only — each derives its "token status" (valid/expired/already-used) from the literal token string in the URL (e.g. `/reset-password/expired`) purely so every state is reachable for testing; **this must be replaced by a real token-validation call**, not treated as a pattern to preserve.

**Proposed endpoints**
```
POST /auth/password-reset/request        { email }
GET  /auth/password-reset/:token         → { status: "valid"|"expired"|"used" }
POST /auth/password-reset/:token         { password } → { status: "ok" }
GET  /auth/verify-email/:token           → { status: "valid"|"expired"|"already-verified" }
GET  /auth/invitations/:token            → { status: "valid"|"expired"|"accepted", orgName }
POST /auth/invitations/:token/accept     → sets up org membership + session
```
`login`/`signup` also now have client-side `submitting`/`error` states wired (invalid credentials, email-already-registered) — these are currently faked with a `setTimeout` and a magic value (`password === "wrong"`, `email === "taken@contoso.com"`); replace the whole submit handler with a real API call, the state shape (`submitting`/`error`) doesn't need to change.

### Billing (expanded)

`BillingSummary` now includes `subscriptionStatus: "trial"|"active"|"past_due"|"cancelled"|"expired"`, `billingCycle`, `renewalDate`, `paymentMethod`. The billing page renders a status banner keyed off `subscriptionStatus` (see `app.billing.tsx`'s `statusBanner` map) — the backend just needs to return the correct status; no frontend change needed to add/remove banner states, only to change wording per status if desired.

### Certificates (expanded)

`Certificate` now includes `holder`, `score`, `verificationStatus: "active"|"revoked"`, `verifyUrl`. `getCertificate(id)` backs the public `/verify/$id` page — **this is a public, unauthenticated endpoint** (no session required) that must return only minimal PII (holder name, track, score, dates) as the current mock already models, never full account data. Returns `null` (not `404`-thrown) for an unknown ID so the frontend can render a normal not-found state — keep that contract (`Certificate | null`) if the API adapter wraps a REST 404 into `null` rather than throwing.

### Audit Logs (expanded)

`AuditLogEntry` now includes `userAgent`, `organization`, `result: "success"|"failure"`. `organization` exists in the type for future multi-tenant filtering but isn't yet surfaced as a UI filter (single-org mock data today) — the backend should support filtering by it once multi-tenancy is real. `userAgent` is intentionally not a table column (kept as a tooltip on the actor cell) to avoid overwidening an already-dense table; expose it in a detail view if one is added later.

---

## Explicitly deferred (not built this pass, with reasons)

- **Correlation graph / entity-relationship UI** — a genuine new interactive-graph surface (user → device → IP → email → OAuth app → cloud resource), not a small addition. Building a shallow version risked exactly the "decorative graph" a serious investigation tool should avoid. Needs its own design pass: what relationships are traversable, how they tie back into evidence pinning.
- **Multi-tenancy parameter threading** — no service currently takes an explicit `orgId`/`userId` parameter. This is deliberate: no real auth exists yet to supply real IDs, so threading them through all 28 service signatures now would be speculative plumbing with no way to verify it's correct. Once real auth lands, every mock/API service method should gain a scoping parameter (or read it from an auth context) — start with Investigations/Alerts/Incidents since they're highest-priority.
- **Platform-admin separation** — intentionally out of scope; per an existing comment in `app-shell.tsx`, a true cross-tenant admin surface belongs on separate infrastructure (e.g. a private admin subdomain), not linked from `/app` at all.
- **A 5th realistic ground-truth scenario** for the "Impossible travel activity detected" alert (`ALT-24817`) — it exists as an alert with no matching investigation/ground-truth case. Left as a gap rather than fabricated, since a real scenario needs matching telemetry events and a scoring rubric, not just a label.
- **Full design-system audit** (buttons/inputs/modals/tabs/tooltips) and **full responsive audit** beyond what this pass and the prior icon-system pass touched — both were done at a point-in-time scope; new surfaces added here (notification panel, new auth pages) were spot-checked against the existing patterns, not re-audited from scratch.

---

## Migration strategy

**Sequencing recommendation** (highest value / most product-critical first):
1. **Investigations + Scoring** — this is the product. Get case telemetry, evidence, submission, and server-side scoring real before anything else.
2. **Alerts / Incidents** — the queue that feeds Investigations.
3. **Account/Auth** — real sessions unlock everything else being multi-user (Organizations, Cohorts, Instructor, StudentAnalytics all currently assume a single local "John Doe").
4. **Organizations / Cohorts / Instructor / Assessments / Feedback** — the training-provider value proposition, needs real auth first.
5. **Leaderboard / MitreExplorer / DashboardPerformance / Analytics / Profile** — becomes real once Investigations scoring produces real history to aggregate over.
6. **Everything else** (Certificates, Achievements, LearningCenter, AuditLogs, Settings, Billing, EvidenceLocker, Search, ThreatIntel, EmailInvestigations) — can stay mocked indefinitely without blocking the core product loop.

**Cutover mechanism**: per domain, change the one export line in `src/services/<domain>/index.ts` from the mock adapter to the API adapter. No route, hook, or component changes required — that's the point of this architecture.

**Data migration notes**: scoring/ground-truth is the one domain where cutover changes the *trust boundary*, not just the data source (see Investigations section above) — treat it as a design task, not a mechanical swap. Everything else is a mechanical swap once the corresponding REST/RPC endpoint exists and returns the same shape the mock currently returns (shapes are defined in each domain's `src/types/*.ts` and `*-service.ts` interface).

**Auth/session notes**: today's `accountType`/`accountName` are the *only* "auth-ish" state, and it's 100% client-side/localStorage. Nothing in this codebase should be read as "the auth system" — it doesn't exist yet. Real auth is a prerequisite for Organizations/Cohorts/Instructor/StudentAnalytics being meaningful (they currently show the same static data regardless of who's "logged in," because no one is really logged in).

## What is explicitly out of scope for backend work right now

- No test framework exists in this repo and none was introduced during this refactor — add one before wiring real endpoints, not after.
- No real payment processor, no real email delivery (the marketing contact form at `src/lib/contact.ts` already has a `TODO(backend)` marker for this), no real SSO/SCIM.
- Client-side score, permission, subscription, and organization-membership state must never be treated as authoritative once a backend exists — this frontend pass only established *where* those boundaries are; it does not enforce them (it can't, without a server).
