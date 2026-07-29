# 17. Frontend Architecture

## 17.1 Application Shells

One codebase, one build, four role-scoped shells selected post-authentication by `users.role` (§6.3), each with its own top-level layout and navigation but sharing the full component library (§17.4) and API client (§17.6):

- **Student Shell** — the primary product surface: scenario catalog, active session workspace (Alert Dashboard, Incident Queue, the four investigation portals, Search, Timeline), progress/leaderboard/certificates.
- **Instructor Shell** — cohort management, review queue, gradebook, scenario authoring entry point (§2.15).
- **Org Admin Shell** — seats, SSO config, billing, org-level analytics (§2.16).
- **Platform Admin Shell** — scenario library management, global user/support tools, platform analytics, audit log viewer.

Route guards check role at the router level (redirecting to the correct shell's home if a user lands on a route outside their role) as a UX convenience only — the actual authorization boundary is enforced server-side (§15.2) and the frontend never trusts a client-side check as a security control.

## 17.2 Routing

File-system-based or centrally-declared routing (implementation detail, §5.1) under top-level prefixes matching the shells: `/app/*` (Student), `/instructor/*`, `/org/*`, `/admin/*`, plus unauthenticated routes `/login`, `/signup`, `/verify/{certificateId}` (public certificate verification, §2.18), and marketing/catalog pages that may be server-rendered or statically generated separately from the authenticated SPA for SEO purposes (course/scenario catalog pages benefit from being crawlable, §1.3's content-marketing acquisition motion). The active-session workspace uses nested routing under `/app/sessions/{sessionId}/...` with each investigation portal, the dashboard, and incident detail as sibling routes sharing a persistent session-level layout (top nav showing session timer/status, always-visible Global Timeline access, §2.9).

## 17.3 State Management

Three distinct state categories, each handled by the tool suited to it rather than one global store for everything:

1. **Server state** (alerts, incidents, entity profiles, scores — anything from §16) — managed by a query/cache library (e.g., TanStack Query or equivalent) providing request deduplication, background refetch, and cache invalidation keyed by the same resource identifiers as the API, with WebSocket events (§16.16) triggering targeted cache invalidation/patching (an `alert.new` message pushes directly into the alerts list cache rather than forcing a full refetch, for responsiveness).
2. **Client/UI state** (open panel, selected filter, draft note text before autosave) — local component state or a lightweight store, deliberately not persisted to any global app-wide state container, since this state is cheap to lose on navigation and coupling it to the server-state layer would only add complexity.
3. **Auth/session state** (current user, role, access token) — a small dedicated auth context/store, the only genuinely global piece of client state, responsible for attaching the bearer token to every API client request (§17.6) and reacting to `401`s by attempting a silent refresh (§5.7) before forcing re-login.

## 17.4 Component Library and Design System

A shared component library (buttons, tables, filter builders, severity badges, entity-type icons, the process-tree renderer, the timeline swimlane renderer) is built once and consumed by all four shells — the severity badge, MITRE technique chip, and entity-profile-link components in particular appear in nearly every screen (Alert Dashboard, Search results, Timeline, all three investigation portals) and are the components most worth investing shared-design-system rigor in, since visual/interaction consistency across those repeated elements is a large part of what makes the product feel like a coherent, professional-grade console rather than a collection of separately-built pages (§1.2, §1.6).

## 17.5 Key Pages and Navigation Flow

- **Catalog → Scenario Detail → Start Session** (`/app/catalog` → `/app/catalog/{slug}` → `POST /sessions` → redirect to `/app/sessions/{id}/dashboard`).
- **Session Dashboard** (`/app/sessions/{id}/dashboard`) — Alert Dashboard (§2.1) as the landing view within an active session, with persistent left-nav to Incident Queue, Identities, Devices, Emails, Search, Timeline, and a session status/timer indicator.
- **Alert Detail** (modal or `/app/sessions/{id}/alerts/{alertId}`) — evidence drill-down, promote-to-incident action.
- **Incident Workspace** (`/app/sessions/{id}/incidents/{incidentId}`) — the densest screen in the product: linked alerts, entity chips, embedded Timeline scoped to the incident, Evidence Collection panel, Analyst Notes panel, and the closure/verdict form — laid out as a three-column workspace (context/notes | primary evidence-timeline | linked-entities-and-actions) on desktop, collapsing to a tabbed single-column layout on narrower viewports (§17.7).
- **Identity/Device/Email Portal** (`/app/sessions/{id}/identities`, `/devices`, `/emails`) — list → profile detail, each profile deep-linkable and cross-linkable from anywhere else in the product (e.g., an alert's primary entity chip links directly to that entity's profile).
- **Results Screen** (`/app/sessions/{id}/results`) — post-submission score breakdown (§2.12), missed-evidence callouts, hint-usage summary, "review full session" (read-only replay of the completed session using `investigation_actions`, §6.13) and "try again"/"next in path" calls to action.
- **Instructor Review Queue → Session Review** — side-by-side automated-score view and full evidence-trail replay, with the feedback form (§16.13) docked alongside.

## 17.6 API Client Layer

A single generated (from the OpenAPI spec, §16.1) typed API client is the only code path allowed to call the backend — no ad hoc `fetch` calls scattered through components — providing compile-time safety against the API contract drifting out from under the frontend, automatic bearer-token attachment and refresh-on-401 retry (§17.3), and centralized error-envelope handling (mapping the standard error shape from §16.1 into user-facing toast/inline messages consistently across the app).

## 17.7 Responsive Behavior

The Student investigation workspace is designed **desktop-first** (multi-panel layouts, process trees, and timelines genuinely need screen real estate to be usable, and this mirrors the real professional tooling context being taught, §1.6) but must remain fully usable down to a tablet-width breakpoint (collapsing multi-column workspaces to tabs, as noted in §17.5) since institutional/classroom usage (§1.3) cannot assume every learner has a large monitor. Below tablet width, the product shows a clear "best experienced on a larger screen" notice on session-workspace routes rather than attempting a fully-featured phone layout — catalog browsing, progress/leaderboard/certificate viewing, and marketing pages remain fully mobile-responsive, since those are plausible phone use cases (§1.4) while active investigation is not.

## 17.8 Accessibility

WCAG 2.1 AA is the baseline target: full keyboard operability for every investigative action (evidence pinning, timeline adding, alert status changes all reachable and actionable without a mouse), semantic HTML and ARIA labeling for the custom process-tree/timeline/severity-badge components specifically (since these are the components most likely to be built as non-standard widgets and therefore most likely to be missed by default), sufficient color contrast including for severity-badge color coding (never color-alone — severity is always paired with a text label/icon, so colorblind users are not dependent on hue distinction), and full support for browser zoom/text-resizing without layout breakage on the dense incident workspace.

## 17.9 Real-Time and Offline-Degradation Behavior

Every screen that consumes WebSocket push updates (§16.16) is built to be **fully correct from a REST GET alone** — the socket is purely a latency optimization, never a data-integrity dependency (§5.10, §3.8). If the WebSocket connection drops, the client falls back to a modest-interval poll (e.g., every 15s) of the affected list endpoints (alerts, incident status) with a small, non-intrusive "reconnecting" indicator, and resumes push-based updates transparently on reconnection — a Student should never be able to tell, other than a brief indicator, that the underlying transport degraded.

## 17.10 Performance Budget

Code-splitting by shell and by route (the Instructor/Org/Platform Admin shells are never downloaded by a Student session, and vice versa) keeps the Student Shell's initial bundle focused on catalog + auth + dashboard, with the heavier investigation-portal and process-tree/timeline rendering code lazy-loaded on first entry into an active session — directly supporting the §3.1 Time-to-Interactive target by ensuring the first meaningful paint never waits on code the current screen doesn't need.
