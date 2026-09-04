# ThreatLens documentation

Two sets of documents live here, and they are not the same kind of thing.

## As-built — what the deployed system does

Derived from the code. Keep these current when behaviour changes.

| Document | Covers |
| --- | --- |
| **[PLATFORM.md](PLATFORM.md)** | Session lifecycle, scoring, the ground-truth boundary, roles and cohort access, deployment |
| **[EVENT-CATALOG.md](EVENT-CATALOG.md)** | The eight telemetry tables, 52 event templates, 20 detection rules |
| **[SCENARIO-CATALOG.md](SCENARIO-CATALOG.md)** | All 30 scenarios — category, difficulty, techniques, correct verdict |

These are checked against the code by `apps/api/src/common/docs/docs-in-sync.spec.ts`, which
runs in the normal API test job. It fails when the counts quoted here — scenarios, templates,
rules, telemetry tables, scoring weights — stop matching source, and when the scenario tables
drift from `seed.ts`. After changing a scenario, run:

```bash
npm run docs:sync --workspace=apps/api
```

The catalogue tables are generated, so edit `seed.ts` rather than the table. Prose is written
by hand; the check only pins the numbers in it, not the wording.

Operational runbooks sit outside this folder: [`infra/RAILWAY.md`](../infra/RAILWAY.md) and
[`infra/DEPLOY.md`](../infra/DEPLOY.md).

## Design specification — what was planned

[`ThreatLens-Architecture.md`](ThreatLens-Architecture.md) and [`parts/`](parts/) are the
original specification, written before the build. They are the source of the `§` references
that appear throughout the codebase's comments, and they remain useful for understanding *why*
something was designed the way it was.

**They describe intent, not current behaviour.** They are written in design tense ("the content
team will", "at MVP launch", "Phase 2"), and the build has since diverged — cohort staffing and
groups, platform-admin access, and the scenario catalogue have all moved on. Treat them as
history. Where they and the as-built documents disagree, the as-built documents and the code
win.

The frontend has its own pair with the same split:
[`apps/web/docs/ARCHITECTURE.md`](../apps/web/docs/ARCHITECTURE.md) (superseded, carries a
banner saying so) and
[`apps/web/docs/THREATLENS_BACKEND_INTEGRATION.md`](../apps/web/docs/THREATLENS_BACKEND_INTEGRATION.md).
