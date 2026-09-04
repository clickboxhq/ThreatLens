# ThreatLens — platform reference

**As-built.** This describes the system that is deployed, derived from the code. For the
original design specification see [`parts/`](parts/) — that set is the *plan*, written before
the build, and the two have diverged in places. Where they disagree, this document and the
code win.

ThreatLens is hands-on security investigation training. A student is dropped into a synthetic
but realistic incident and works it the way an analyst would: read the telemetry, pin the
evidence that matters, tag the MITRE techniques the evidence supports, take a response action,
and commit to a verdict. A server-side engine then grades the *investigation*, not just the
answer.

- **[Event catalogue](EVENT-CATALOG.md)** — the eight telemetry tables, 52 event templates, 20 detection rules
- **[Scenario catalogue](SCENARIO-CATALOG.md)** — all 30 scenarios, what each teaches, and the correct verdict

## The session lifecycle

A session is one attempt at one scenario. It is the spine everything else hangs off.

```
POST /sessions
  ↓  scenario must be published; email must be verified
  ↓  a random seed is stored on the session
[telemetry-generation queue]
  ↓  materialise the population, baseline noise, and kill chain into the 8 tables
[alert-correlation queue]
  ↓  run the 20 detection rules over what was generated → alerts
  ↓
STUDENT WORKS THE CASE
  ↓  read portals · pin evidence · build timeline · tag techniques · take actions · request hints
  ↓
POST /sessions/:id/incidents/:incidentId/close   { verdict, summary, mitreTechniqueIds }
POST /sessions/:id/submit
  ↓
[scoring queue]
  ↓  compare what was pinned and tagged against the ground truth
GET /sessions/:id/score
```

Three BullMQ queues (`telemetry-generation`, `alert-correlation`, `scoring`) run in a separate
worker process from the REST API. Sessions expire six hours after they start.

One session contains one or more **incidents**. The incident is what carries a verdict; the
session is what carries a score.

| Incident status | Meaning |
| --- | --- |
| `open` | Created from an alert, not yet worked |
| `investigating` | Student has started |
| `contained` | A response action has been taken |
| `closed` | A verdict has been committed |
| `reopened` | An instructor sent it back |

| Verdict | Meaning |
| --- | --- |
| `true_positive` | A real attack, correctly detected |
| `false_positive` | The activity was never suspicious once understood |
| `benign_positive` | Real, correctly-detected activity that is nonetheless authorised |

## Scoring

Weights live in `apps/api/src/modules/scoring/scorer.ts` and are the source of truth:

| Component | Weight | What it measures |
| --- | ---: | --- |
| Technique accuracy | 30% | Tagged techniques vs. the rubric's required set — precision *and* recall |
| Evidence | 30% | Ground-truth rows pinned, against rows missed |
| False-positive handling | 15% | Whether decoy activity was correctly left alone |
| Response actions | 15% | Whether the actions taken match what the scenario called for |
| Verdict | 10% | The final call |

A hint penalty is then applied proportionally to each hint's authored cost. Hints are always
available and never paywalled — a stuck student who gives up costs more than one who takes a
deduction.

The weighting is deliberate: the verdict alone is 10%. Guessing "true positive" correctly with
no supporting work scores poorly, which is the behaviour the platform exists to train out.

## The ground-truth boundary

**The browser must never receive the answer.** Everything a student is graded on —
`is_ground_truth_evidence`, `mitre_technique_id`, `correlation_id`, and a scenario's
`required_techniques` — stays server-side.

This is enforced by **allow-list DTOs**: `toStudentXxxDto` functions in
`apps/api/src/common/dto/` name the fields that may be serialised, so a new column added to a
telemetry table is invisible to clients until somebody deliberately adds it.

The direction matters, and there is a scar behind it. An allow-list only protects endpoints
that *opt into* it. The scenario catalogue predated the pattern, and a `techniqueIds` field was
once added to it — byte-identical to the rubric's `required_techniques`, i.e. 30% of the grade,
served to anyone who opened the scenario list. The lesson is not "we fixed a leak" but that
**every new endpoint returning scenario or telemetry data must be checked against this
boundary explicitly**; the allow-list will not catch it for you.

Learning recommendations are computed server-side (`GET /scenarios/recommended`) for the same
reason — the client cannot compare technique lists it is not allowed to have.

## Roles and access

| Role | Can |
| --- | --- |
| `student` | Work their own sessions; join cohorts by code |
| `instructor` | Everything their cohort staffing allows (below) |
| `org_admin` | **Read** every cohort in their organisation; never write |
| `platform_admin` | Read any cohort and repair its staffing; read any session; author scenarios; read audit logs. **Cannot teach** — no assignments, grading or feedback |

Cohorts have their own staffing model, separate from the account role:

| Cohort role | Can |
| --- | --- |
| `lead` | Full control, including adding and removing staff |
| `tutor` | Teach the whole cohort — assignments, review queue, feedback |
| `group_tutor` | The same, but only for the groups they are assigned to |

Rules worth knowing:

- **A cohort can never lose its last lead.** Only a lead can staff a cohort, so one with none
  is unadministrable and needs database surgery to recover. Removing or demoting the final
  lead is refused.
- **A platform admin cannot staff themselves.** Otherwise "can repair, cannot teach" would be
  one API call from untrue. Staffing done by a platform admin is flagged
  `platformAdminOverride` in the audit log, because support repairing a cohort and the
  cohort's own lead acting normally otherwise produce identical rows.
- **Unreachable cohorts return 404, not 403**, so cohort ids cannot be probed.
- **Group-scoped assignments are enforced on both the listing and the launch.** Hiding a row
  is presentation; refusing the request is the boundary. A student who knows another group's
  assignment id still cannot start it.

## Deployment

Railway, from `main` via GitHub Actions. Services: `api`, `worker`, `web`, Postgres, Redis.

- CI runs API build+test, an e2e job against real Postgres and Redis, and a web build; then
  publishes images and redeploys.
- **A green `Deploy to Railway` job is not the same as traffic cutover** — allow a few minutes.
- Migrations run on `api` boot. Seeding is manual and version-aware:
  `railway ssh --service api -- npm run prisma:seed`.
- Break-glass scripts, run the same way: `npm run admin:grant`, `npm run admin:reset-mfa`.
