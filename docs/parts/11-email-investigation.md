# 11. Email Investigation Module

## 11.1 Purpose

The Email Portal is SOCVerse's proprietary analog to an Outlook/Defender for Office 365-style message investigation surface (§1.6) — the primary surface for phishing and Business Email Compromise (BEC) scenario categories (§1.8). Backed by `email_messages`, `email_attachments`, and `email_urls` (§6.12.9), scoped to the active `session_id`.

## 11.2 Mailbox/Message Search

List view of `email_messages` for the session, filterable by direction, sender, subject keyword, SPF/DKIM/DMARC result, and "has attachment"/"has URL" toggles — supporting the same field=value search ergonomics as the platform-wide Search feature (§2.8), scoped specifically to email fields for faster in-portal triage.

## 11.3 Email Viewer

Two-pane message reader: a rendered view (`body_html`, sandboxed/sanitized for safe display — see §11.7) styled to resemble a familiar mail-client reading pane, and a "View Source"/raw-headers toggle exposing `headers_raw` in full RFC 5322-shaped text, including the synthetic `Received:` relay chain, `Message-ID`, and `Authentication-Results:` header — mirroring the real investigative habit of checking raw headers when the rendered view is insufficient or suspected of being spoofed.

## 11.4 Authentication Results (SPF/DKIM/DMARC)

Dedicated panel summarizing `spf_result`, `dkim_result`, and `dmarc_result` in plain-language form (e.g., "SPF: Fail — sending IP not authorized for this domain") alongside the raw `Authentication-Results:` header line, so a Student learns to read both the human-readable summary and the raw form real tooling actually presents. BEC scenarios (§1.8) specifically exercise the case where authentication passes cleanly (a compromised legitimate mailbox, or a convincing lookalike domain with its own valid SPF/DKIM) — the panel never itself declares a verdict; it only reports the mechanical result, keeping the "is this actually malicious" judgment the Student's task.

## 11.5 Attachment Analysis

`email_attachments` rows for the open message, each showing filename, content type, size, hash, and `sandbox_verdict`. Clicking a hash cross-links to the Threat Intelligence lookup (§2.7) for full indicator context. **No real file content is ever generated, stored, or served** — attachments are metadata-only records; "sandbox_verdict" is an authored/generated field, not the output of an actual sandboxing process, consistent with the platform never handling or executing any real (or even realistic-but-functional) malicious code (§15.11's secure-content principle).

## 11.6 URL Analysis

`email_urls` rows for the open message: displayed URL vs. actual target (supporting lookalike-domain and link-mismatch investigation), `reputation` (from the same scale as §2.7), and `is_rewritten_by_safe_links` (modeling the common enterprise pattern of URL-rewriting security gateways, so Students learn to recognize and unwrap rewritten links). Clicking through **never navigates anywhere** — target URLs are inert display strings rendered as plain text/copy-to-clipboard, not live anchors, eliminating any possibility of a Student's browser actually requesting an external (even if internally-hosted-and-safe) address from within a graded investigation flow.

## 11.7 Sandbox Results

Presented as part of the Attachment Analysis panel (§11.5) rather than a separate service: `sandbox_verdict` plus an authored free-text "behavioral summary" field (e.g., "Dropped and executed a secondary payload; established outbound connection to 45.x.x.x on port 443") giving the Student sandbox-report-style narrative detail to correlate against the Device Portal's process/network timeline for the recipient's device — this cross-portal correlation (email → device) is one of the primary "connect the dots across consoles" learning objectives the whole multi-console design exists to teach (§1.2).

## 11.8 Campaign Correlation

A "Similar Messages" panel on the message detail view surfaces other `email_messages` in the same session sharing sender domain, a common `correlation_id` (§7.2), or overlapping `email_urls`/`email_attachments` hashes — supporting scenarios where a phishing campaign targets multiple identities and the Student must recognize the pattern across mailboxes, not just assess one message in isolation (directly relevant to BEC and broader campaign-style scenario narratives, §1.8).

## 11.9 Threat Intelligence Integration

Every hash (`email_attachments.hash_sha256`) and URL/domain (`email_urls.url`) is resolvable through the same `threat_intel_indicators` lookup used platform-wide (§2.7, §6.15) — the Email Portal does not maintain a separate reputation system, keeping "what is this indicator's reputation" a single, consistent answer regardless of which portal a Student encountered it from first.

## 11.10 What Is Never Exposed to the Student

Identical policy to §9.9/§10.12: `email_messages.is_ground_truth_evidence` and `mitre_technique_id` are stripped at the serialization layer (§18.3). Additionally, because `body_html` is rendered client-side, it is sanitized server-side (strip `<script>`, event handlers, and any active content, §15.6) before ever leaving the API — defending against the theoretical case of a maliciously-authored scenario template accidentally including unsafe markup, not because any real inbound content is untrusted (all content is authored by SOCVerse's own content team, §12.1).
