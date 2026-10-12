# ThreatLens threat model

`threatlens.json` is an [OWASP Threat Dragon](https://owasp.org/www-project-threat-dragon/)
model of the platform — one STRIDE data-flow diagram covering the web app, API, worker, and the
stores and third parties they talk to.

## Opening it

In Threat Dragon (desktop or web): **Open Existing Threat Model** → choose
`docs/threat-model/threatlens.json`. The diagram is under *ThreatLens → ThreatLens — platform
data flow*.

Threats live on the elements themselves, so selecting a component shows its own list in the
**Threats** panel rather than one flat register. **Report** prints the whole model.

## What it covers

Three trust boundaries: the public internet (browsers and the people using them), the Railway
private network (API, worker, Postgres, Redis), and third parties (Resend).

Two assets carry most of the risk, and the model is organised around them:

- **Scenario ground truth** — `groundTruthDefinition` holds the required techniques and the
  expected verdict, which are forty per cent of a student's mark, plus hint text that is meant
  to cost score to read. Disclosing it does not merely leak data; it invalidates the product.
  It is modelled as its own store rather than folded into Postgres so the threats against it
  stay visible.
- **Account data** — names, email addresses, uploaded avatars and a full performance history,
  for a user base that includes students. The impact of a breach here is personal rather than
  financial.

## Reading the threat statuses

`Mitigated` threats are real failures that were found and fixed, not hypotheticals. Each one
records what actually went wrong — the concurrent-refresh race that signed active users out,
the Redis volume going read-only and taking signup and login down with it, deleted accounts
that kept working — so the reasoning survives the fix and nobody reintroduces it.

`Open` threats are genuinely open. Several are accepted risks rather than bugs; the mitigation
field says what closing one would involve.

## Keeping it current

The model is generated from a script rather than hand-edited, but Threat Dragon rewrites the
file when you save from the UI. Either is fine — edit in the UI for small changes, and treat
the committed JSON as the source of truth. Review it when a new external dependency, data store
or privileged role appears, since those are the changes that move trust boundaries.
