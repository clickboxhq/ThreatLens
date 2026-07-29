# 15. Security Architecture

## 15.1 Authentication

- Passwords: argon2id (memory-hard, GPU-resistant), tuned parameters reviewed annually against current OWASP guidance; never MD5/SHA1/bcrypt-only.
- Minimum password policy: length-based (12+ characters) rather than arbitrary complexity rules, per current NIST 800-63B guidance, checked against a common-password blocklist at signup/change time.
- Email verification required before a self-serve account can start a scored (leaderboard/certificate-eligible) session; unverified accounts can still explore free-tier content to avoid a signup-friction cliff.
- Account lockout: progressive delay + eventual temporary lockout after repeated failed attempts (Redis-backed counter keyed by account + IP, distinct from the general API rate limiter in §15.5), with an audit_logs `login_failed` entry per attempt (§6.22) for anomaly review.
- MFA: TOTP-based optional MFA for individual accounts, **mandatory** for Org Admin and Platform Admin roles given their access breadth (§15.2) — enforced at login, not just offered.
- SSO (SAML 2.0 / OIDC): Phase 2 addition for institutional buyers (§5.5), terminating into the same internal JWT issuance path as password auth so downstream authorization logic is identical regardless of auth method.

## 15.2 Authorization (RBAC)

Four platform roles (`users.role`, §6.3): `student`, `instructor`, `org_admin`, `platform_admin`. Authorization is enforced in two layers, both required (defense in depth — neither is trusted alone):

1. **Coarse, route-level (API Gateway, §5.2):** a static role→route matrix rejects a request before it reaches any business logic if the role can never legitimately call that route (e.g., `student` can never call any `/admin/*` route).
2. **Fine, resource-level (owning domain service, §4.3 step 4):** does *this specific* caller own or have a legitimate relationship to *this specific* resource — e.g., does `sessionId` belong to `user_id`; is `instructor_id` actually the owner of the cohort containing this Student; is `org_id` on the caller's token the same `org_id` as the target resource. This check happens on every read and write, not only writes, since unauthorized read access to another Student's session would itself leak ground-truth-adjacent information and violate the assessment-integrity goals in §12.3.

Role capability summary: `student` — own sessions/scores/certificates only. `instructor` — own cohorts, enrolled Students' sessions within those cohorts (read + feedback, never edit the Student's own submission), scenario authoring (Phase 2). `org_admin` — own org's users/cohorts/billing/SSO config, no cross-org access, no access to specific Student investigation content beyond aggregate analytics (§2.17) unless also holding an instructor relationship. `platform_admin` — full platform access, gated additionally by mandatory MFA (§15.1) and full audit logging of every admin action including read-level "support" access (§15.9).

## 15.3 Encryption

- **In transit:** TLS 1.2+ enforced on every public endpoint (HTTP requests to port 80 receive a redirect only, no data is ever served over plaintext HTTP); internal service-to-service traffic at Scale (§19.4) runs over the cluster's private network with TLS between mesh-connected services where the deployment platform supports it, and is never exposed to the public internet regardless (§4.5).
- **At rest:** the database volume and object storage are encrypted at rest using the host/provider's disk or bucket-level encryption (LUKS on the MVP VPS; provider-managed encryption at Scale) — application-layer field encryption is *not* used for the synthetic telemetry tables (there is no real-world sensitive content there to protect beyond standard disk encryption) but **is** used for `organizations.sso_config` secret-bearing fields and any stored payment-related reference tokens (§20 — SOCVerse never stores raw card data itself; billing integrates with a PCI-compliant processor, §15.8).
- Backups (§3.11) inherit the same at-rest encryption and are additionally encrypted with a backup-specific key before leaving the primary environment.

## 15.4 Secrets Management

Covered operationally in §5.17. Security-specific requirements: secrets are never logged (a log-scrubbing middleware redacts known secret-shaped fields — `password`, `token`, `secret`, `authorization` — from any structured log line before it is written, as a defense-in-depth backstop against a developer accidentally logging a full request object); the JWT signing key is rotated on a routine schedule and immediately on any suspected compromise, with a brief dual-key acceptance window (old key still validates existing unexpired tokens; new key signs everything new) to avoid mass session invalidation on rotation.

## 15.5 Rate Limiting

Redis-backed sliding-window limiter at the API Gateway (§5.2), tiered: unauthenticated endpoints (login, signup, password reset) limited per-IP tightly (e.g., 10/minute) given their abuse potential (credential stuffing, account enumeration); authenticated endpoints limited per-user at a generous level tuned to not interfere with normal investigative click-through speed, with a stricter limit specifically on session-start/telemetry-generation-triggering endpoints (§7.7) since each is a real compute cost; a separate, much stricter limiter applies to AI feature endpoints (§14.8) given their per-call cost. Exceeding a limit returns `429` with a `Retry-After` header; sustained abuse from one identity escalates to a temporary account flag reviewed by Platform Admin tooling (§2.16).

## 15.6 API Security

- Every request body is validated against its OpenAPI-derived schema (§5.2, §16) before reaching handler code — type, required-field, and length constraints rejected at the edge.
- Object storage access is exclusively via short-lived signed URLs (§5.11); no bucket is ever public.
- CORS is restricted to the platform's own frontend origin(s); no wildcard origin in production.
- Sensitive response fields (§9.9, §10.12, §11.10, §12.3) are stripped at a shared serialization layer, not per-endpoint — a new endpoint inherits safety by construction rather than requiring the author to remember to strip fields.
- CSRF is not applicable to the primary API surface (Bearer-token JWT auth, not cookie-session auth, §5.7), but any cookie-based flow that is introduced (e.g., a "remember me" refresh-token cookie option) uses `SameSite=Strict`/`Lax` plus standard double-submit CSRF protection.
- Rendered email HTML (§11.10) is sanitized server-side before ever reaching the client.

## 15.7 Session Management

Detailed token mechanics in §5.7. Security-relevant behaviors: refresh-token rotation with reuse detection (a previously-rotated-away token being presented again immediately revokes the entire token family and forces re-authentication, since it indicates token theft, §6.19); `session_version` bump on password change/MFA change/explicit "log out everywhere" instantly invalidates all previously-issued access tokens without requiring a server-side blocklist of every token (§5.7); idle-session frontend timeout with a re-authentication prompt for Org/Platform Admin sessions specifically, given their access sensitivity.

## 15.8 Payment Security

SOCVerse never handles, stores, or transmits raw payment card data — all billing/subscription payment collection is delegated to a PCI-DSS-compliant third-party payment processor's hosted checkout/tokenization flow (§20); the platform stores only the processor-issued customer/subscription reference tokens (`organizations.billing_customer_id`, §6.4, and an equivalent field on `users` for individual subscriptions), keeping SOCVerse itself out of PCI-DSS scope entirely — a deliberate, cost- and risk-reducing architectural choice appropriate for a bootstrapped team (§20).

## 15.9 Audit Logging

Full schema in §6.22. Security-specific requirement beyond what's stated there: **admin impersonation** (a Platform Admin support tool allowing "view as this user" for troubleshooting) is logged with its own distinct `audit_logs.action = 'admin_impersonation_started'`/`'ended'` pair including the impersonated `target_id`, is time-boxed (auto-expires after a short window, requiring re-initiation rather than a standing session), is visually indicated in the UI at all times during an impersonated session (a persistent banner, never a silent capability), and — critically — impersonation sessions are read-only by default; any state-mutating action taken while impersonating requires a distinct, separately-logged explicit confirmation step, since silent support-driven mutation of a Student's graded work would undermine the assessment integrity the whole platform depends on.

## 15.10 Input Validation

Beyond §15.6's schema-level validation: all user-authored free text (Analyst Notes §2.13, incident summaries §2.3, instructor feedback §6.20) is treated as untrusted on output (rendered with framework-default HTML-escaping, never `dangerouslySetInnerHTML`/`innerHTML`-equivalent raw injection, §17) even though it is never executed server-side — this is standard stored-XSS defense applied consistently regardless of the (low) likelihood of a malicious Student in an education product, because the cost of applying it uniformly is near-zero and the cost of an XSS incident (especially one that could reach an Instructor or Admin viewing Student-authored content) is not.

## 15.11 Secure Coding Practices

- Dependency scanning (automated, in CI, §5.1) against known-vulnerability databases for both frontend and backend dependency trees, blocking merges on newly-introduced critical vulnerabilities.
- Static analysis/linting includes a security-focused rule set (no `eval`, no unsanitized template construction, no hardcoded secrets — the last backed by a pre-commit secret-scanning hook, §5.17) as a required CI gate, not an optional warning.
- No real malicious code, functional exploit payloads, or live-callback infrastructure is ever present anywhere in the platform's synthetic content (§7.6, §11.5) — every "malicious" artifact a Student encounters is inert metadata, by explicit content-authoring policy enforced in the scenario validation pipeline (§12.6).
- Principle of least privilege applied to infrastructure credentials: the application's database role has no `DROP`/`ALTER` grants in production (migrations run under a separate, more privileged role invoked only by the CI/CD migration step, §6.24); the `audit_logs` table specifically revokes `UPDATE`/`DELETE` from the application role (§6.22).

## 15.12 Data Subject Rights / Account Deletion

An account-deletion request (self-serve or support-initiated) triggers a background job that anonymizes/removes personal data from `users` (email, display name) while preserving the row as a tombstone (soft delete, §6.1) so that referential integrity for aggregate analytics (§2.17) and cohort/institutional records (which may have independent retention obligations, e.g., an institution's own academic record requirements) is not broken; all directly-identifying content the user authored (Analyst Notes, incident summaries containing their own writing) is deleted outright rather than anonymized-and-kept, since anonymized free text can still be re-identifying. This flow is documented in a runbook and is a Platform Admin-triggered action, logged in `audit_logs`, not a fully self-service instant-delete button at MVP, given the cross-table cleanup involved — full self-service deletion is a Scale-phase enhancement once volume justifies automating it further.
