# 16. API Specification

## 16.1 Conventions

- Base path: `/api/v1`. All requests/responses are `application/json` (UTF-8). All endpoints except `/auth/*` and `/public/*` require `Authorization: Bearer <access_token>` (§5.7).
- Every response includes an `X-Correlation-Id` header (§5.2). Every list endpoint supports `?page=&pageSize=` (default `pageSize=25`, max `100`) and returns a standard envelope: `{ "data": [...], "meta": { "page", "pageSize", "totalCount" } }`.
- Errors follow a standard shape: `{ "error": { "code": "STRING_CODE", "message": "human readable", "correlationId": "uuid" } }` with the appropriate HTTP status (`400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict, `429` rate limited, `500` unexpected).
- A machine-readable OpenAPI 3.1 document is the canonical, generated-from-code source of truth in the actual repository; this section is the human-readable reference derived from it and takes precedence only where the two might drift during initial build-out.

## 16.2 Auth Service (`/api/v1/auth`)

**`POST /auth/signup`**
Request: `{ "email": "a@b.com", "password": "correct horse battery staple", "displayName": "A. Student" }`
Response `201`: `{ "userId": "uuid", "emailVerificationRequired": true }`

**`POST /auth/login`**
Request: `{ "email": "a@b.com", "password": "..." }`
Response `200`: `{ "accessToken": "jwt", "refreshToken": "opaque", "expiresIn": 900, "user": { "id", "displayName", "role" } }`
Response `401`: standard error envelope, `code: "INVALID_CREDENTIALS"`.

**`POST /auth/refresh`**
Request: `{ "refreshToken": "opaque" }` → Response `200`: new `{ accessToken, refreshToken, expiresIn }` (rotated, §5.7).

**`POST /auth/logout`** — revokes the presented refresh token. **`POST /auth/logout-all`** — bumps `session_version` (§5.7), revokes all refresh tokens for the user.

**`POST /auth/mfa/verify`** — `{ "mfaChallengeId", "code" }` → completes login for MFA-enrolled accounts (§15.1).

## 16.3 Scenario Catalog Service (`/api/v1/scenarios`)

**`GET /scenarios`** — filters: `?category=&difficulty=&careerTrack=`. Response `200`:
```json
{ "data": [ { "id", "slug", "title", "summary", "category", "difficulty", "estimatedMinutes" } ], "meta": {...} }
```
(never includes `ground_truth_definition` or any internal version metadata beyond `id`, §12.3).

**`GET /scenarios/{slug}`** — full learner-facing detail for the catalog page (§17.5).

## 16.4 Session Service (`/api/v1/sessions`)

**`POST /sessions`**
Request: `{ "scenarioId": "uuid", "cohortAssignmentId": "uuid|null" }`
Response `201`: `{ "sessionId": "uuid", "status": "provisioning" }` — `provisioning` if a synchronous generation path was taken (§7.7); client polls `GET /sessions/{id}` or listens on the WebSocket channel for a `session.ready` event.

**`GET /sessions/{id}`** → `{ "id", "scenarioId", "status", "startedAt", "expiresAt", "currentScenarioTime" }`.

**`POST /sessions/{id}/submit`**
Request: `{ "incidentIds": ["uuid", ...] }`
Response `202`: `{ "scoringStatus": "queued" }` — scoring runs async (§12.4); client polls `GET /sessions/{id}/score` or listens for `score.ready`.

**`GET /sessions/{id}/score`** → full `scores` row shape including `rubricBreakdown` (§6.14), `404` if not yet scored.

## 16.5 Alert Service (`/api/v1/sessions/{sessionId}/alerts`)

**`GET /alerts`** — filters: `?severity=&status=&entityType=`. Response item shape:
```json
{ "id", "title", "description", "severity", "status", "primaryEntityType", "primaryEntityId",
  "mitreTechnique": { "id", "techniqueId", "name" }, "dedupCount", "firstSeenAt", "lastSeenAt" }
```

**`GET /alerts/{id}/evidence`** → `{ "alertId", "evidence": [ { "eventTable", "eventId", "occurredAt", "summary" } ] }` — resolved from `alert_evidence_refs` (§6.15), each `summary` a redacted, Student-safe rendering of the underlying event.

**`PATCH /alerts/{id}`**
Request: `{ "status": "dismissed", "dismissalReason": "Expected admin RDP session per change ticket." }` — `dismissalReason` required (400 if missing) when `status = "dismissed"` (§2.1, §8.6).

## 16.6 Incident Service (`/api/v1/sessions/{sessionId}/incidents`)

**`POST /incidents`** → `{ "title": "Suspicious sign-in + malware execution on FIN-WKS-04" }` → `201` with new incident.
**`POST /incidents/{id}/alerts`** → `{ "alertIds": ["uuid"] }` — links alerts (§2.2).
**`PATCH /incidents/{id}`** — status transitions (§2.3): `{ "status": "investigating" }`.
**`POST /incidents/{id}/close`**
Request:
```json
{ "verdict": "true_positive", "summary": "...", "mitreTechniqueIds": ["uuid", "uuid"] }
```
Response `200`: closed incident; `409` if `evidenceCollection` count is below the scenario's `min_evidence_items` (§12.1) with `code: "INSUFFICIENT_EVIDENCE"`.

## 16.7 Evidence, Notes, and Timeline (`/api/v1/sessions/{sessionId}/incidents/{incidentId}`)

**`POST /evidence`** → `{ "eventTable": "process_events", "eventId": "uuid", "justification": "Unsigned binary spawned from Outlook.", "mitreTechniqueId": "uuid|null" }`.
**`GET /evidence`** / **`DELETE /evidence/{id}`**.
**`POST /notes`** → `{ "body": "..." }`; **`GET /notes`**.
**`GET /timeline`** → merged, chronologically-sorted view across every evidence-collection item's source event plus manually-added items, each entity-tagged for swimlane rendering (§2.9).

## 16.8 Investigation Actions (`/api/v1/sessions/{sessionId}/actions`)

**`POST /actions`**
Request: `{ "actionType": "isolate_device", "targetType": "device", "targetId": "uuid", "incidentId": "uuid|null" }`
Response `200`: `{ "actionId", "occurredAt" }` — also mutates the target entity's state where applicable (e.g., `devices.isolation_status`, §10.11) within the same transaction.

## 16.9 Identity Portal (`/api/v1/sessions/{sessionId}/identities`)

**`GET /identities`** — filters: `?riskLevel=&department=&mfaStatus=&hasRiskySignins=true`.
**`GET /identities/{id}`** → full profile (§9.3): overview, devices, groups, conditionalAccess, riskLevel, mfaStatus.
**`GET /identities/{id}/signins`** — filters: `?result=&from=&to=&riskyOnly=true`; each item includes computed `distanceFromPreviousKm`/`impliedTravelSpeedKmh` when a previous sign-in exists (§9.6).

## 16.10 Device Portal (`/api/v1/sessions/{sessionId}/devices`)

**`GET /devices`** / **`GET /devices/{id}`** → overview + `installedSoftware`, `services`, `startupEntries` (§10.2).
**`GET /devices/{id}/process-tree`** → nested tree structure rooted at each top-level process (§10.3), `?commandLineContains=` filter flattens-and-highlights matches without pruning ancestor/descendant context.
**`GET /devices/{id}/network`**, **`GET /devices/{id}/files`**, **`GET /devices/{id}/registry`**, **`GET /devices/{id}/usb`**, **`GET /devices/{id}/timeline`** (§10.8, consolidated cross-artifact feed).

## 16.11 Email Portal (`/api/v1/sessions/{sessionId}/emails`)

**`GET /emails`** — filters per §11.2. **`GET /emails/{id}`** → full message incl. `headersRaw`, `authResults: { spf, dkim, dmarc }`, `attachments[]`, `urls[]`.
**`GET /emails/{id}/similar`** → campaign correlation results (§11.8).

## 16.12 Search and Threat Intel (`/api/v1/sessions/{sessionId}`)

**`POST /search`** → `{ "filters": [ { "field": "sourceIp", "value": "45.x.x.x" } ], "freetext": "optional" }` → unified cross-table result list, each item entity-tagged with one-click `addToTimeline`/`pinEvidence` action references (§2.8).
**`GET /threat-intel?type=hash&value=...`** → `{ "value", "type", "reputation", "actorAttribution", "context" }`, `404` (rendered client-side as "Unknown") if not present in the scenario's `threat_intel_indicators` (§2.7).

## 16.13 Instructor Service (`/api/v1/instructor`)

**`POST /cohorts`**, **`GET /cohorts/{id}/roster`**, **`POST /cohorts/{id}/assignments`** → `{ "scenarioId|learningPathId", "dueAt", "attemptLimit", "aiAssistanceEnabled": true }` (§14.7).
**`GET /cohorts/{id}/review-queue`** → sessions awaiting review, each with automated `scores` alongside a link to the full evidence trail.
**`POST /incidents/{id}/instructor-feedback`** → `{ "rubricOverrides": {...}, "comment": "...", "reopenSession": false }` (§6.20).
**`GET /cohorts/{id}/gradebook.csv`** → CSV export (§2.15).

## 16.14 Admin Service (`/api/v1/admin`)

**`GET /admin/scenarios`**, **`POST /admin/scenarios/{id}/versions`**, **`POST /admin/scenarios/{id}/publish`** (runs the validation pipeline, §12.6; `422` with itemized validation failures on failure).
**`GET /admin/orgs/{id}/usage`** (§2.17). **`POST /admin/impersonate`** → `{ "targetUserId" }` → short-lived, clearly-flagged impersonation token (§15.9).
**`GET /admin/audit-logs`** — filters: `?actorUserId=&action=&from=&to=` (§6.22).

## 16.15 Learning Platform Service (`/api/v1/learning`)

**`GET /courses`**, **`GET /paths/{id}`** (with computed progress, §13.2), **`GET /leaderboard?period=weekly&scope=org`** (§13.5), **`GET /certificates/mine`**, **`GET /public/verify/{certificateId}`** (unauthenticated, §2.18).

## 16.16 WebSocket Channel

`wss://.../ws?sessionId={id}` (auth via first-message frame `{ "type": "auth", "accessToken": "..." }`, §5.10). Server→client message types:
```json
{ "type": "alert.new", "payload": { ...alert shape from §16.5 } }
{ "type": "alert.updated", "payload": { "id", "status" } }
{ "type": "incident.status_changed", "payload": { "id", "status" } }
{ "type": "session.time_advanced", "payload": { "currentScenarioTime" } }
```
Every message type has a REST fallback (§5.10) so a missed/dropped socket message never leaves client state permanently stale (§17.9).
