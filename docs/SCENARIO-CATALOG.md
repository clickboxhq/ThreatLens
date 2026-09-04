# Scenario catalogue

**As-built.** Generated from `apps/api/prisma/seed.ts`, which is the source of truth — a
scenario exists because it is in that file, and `npm run prisma:seed` publishes it.

30 scenarios across 8 categories. Every one is a complete narrative: a seeded population of
identities and devices, an authored kill chain, decoy activity to distinguish it from, and a
rubric the Scoring Engine grades against.

## What a scenario is made of

Each entry in the seed carries a `groundTruthDefinition` with four parts:

| Part | What it does |
| --- | --- |
| `metadata` | Category, difficulty, estimated minutes, narrative summary |
| `population` | The identities and devices in the story, plus how much decoy noise surrounds them |
| `kill_chain` | Ordered steps, each naming an event template, an entity, and a relative time |
| `scoring_rubric` | Required techniques, minimum evidence, expected verdict, expected actions |

`scoring_rubric.required_techniques` **is the answer key** for 30% of the grade. It is never
sent to a browser — see [PLATFORM.md](PLATFORM.md#the-ground-truth-boundary).

## Difficulty

| Level | Count | What changes |
| --- | ---: | --- |
| Beginner | 6 | Short chains, less decoy noise, the signal is findable once you look in the right portal |
| Intermediate | 10 | More entities, more distractors, usually spans two portals |
| Advanced | 14 | Long chains, heavy noise, cross-portal correlation required |

## Not every scenario is an attack

Three scenarios are deliberately **not** true positives. They exist because an analyst who
escalates everything is not doing the job, and a training set of nothing but real attacks
teaches exactly that reflex.

| Scenario | Correct verdict | What it is really |
| --- | --- | --- |
| `monitoring-agent-flagged-as-webshell` | False positive | An uptime monitor hitting a health-check script |
| `batch-export-mistaken-for-enumeration` | False positive | A scheduled reporting job reading many records |
| `vendor-mail-spf-failure-after-migration` | Benign positive | A genuine vendor whose SPF broke after a mail migration |

The distinction between the two verdicts matters: a **false positive** is activity that was
never suspicious once understood; a **benign positive** is real, correctly-detected activity
that happens to be authorised. Grading treats them as different answers.

## The catalogue

<!-- BEGIN GENERATED: scenario-tables -->

### Identity (7)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Identity — Sustained Password Guessing Against One Account**<br>`brute-force-single-account` | beginner | 20 | True positive | `T1110.001` |
| **Impossible Travel**<br>`impossible-travel` | beginner | 15 | True positive | `T1078` |
| **Identity — Breach Credentials Replayed Against Staff Accounts**<br>`credential-stuffing-reused-passwords` | intermediate | 25 | True positive | `T1110.004`, `T1078` |
| **Legacy Authentication Bypassing Enforced MFA**<br>`legacy-auth-mfa-bypass` | intermediate | 20 | True positive | `T1078`, `T1114.002` |
| **MFA Fatigue — Push Bombing**<br>`mfa-fatigue-push-bombing` | intermediate | 20 | True positive | `T1621`, `T1078` |
| **Password Spraying Campaign**<br>`password-spraying-campaign` | intermediate | 25 | True positive | `T1110.003`, `T1078` |
| **Identity — Account Added Itself to an Administrator Group**<br>`privilege-escalation-group-membership` | advanced | 30 | True positive | `T1098`, `T1078` |

### Email (3)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Email — SPF Failure on a Genuine Vendor Notification**<br>`vendor-mail-spf-failure-after-migration` | beginner | 20 | Benign positive | — *(no attack to tag)* |
| **Phishing → Stolen Credentials → Risky Sign-in**<br>`phishing-stolen-credentials` | beginner | 30 | True positive | `T1566.002`, `T1078` |
| **Business Email Compromise — Executive Wire Transfer Fraud**<br>`bec-wire-transfer-fraud` | intermediate | 20 | True positive | `T1656` |

### Endpoint (3)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Credential Dumping — LSASS Memory Access via comsvcs.dll**<br>`credential-dumping-lsass-comsvcs` | advanced | 25 | True positive | `T1003.001`, `T1071.001` |
| **Endpoint — Kerberoasting for Service Account Compromise**<br>`kerberoasting-service-account-pivot` | advanced | 30 | True positive | `T1558.003`, `T1078.002` |
| **Malware Execution via Email Attachment**<br>`malware-execution-via-attachment` | advanced | 35 | True positive | `T1566.001`, `T1204.002`, `T1071.001` |

### Malware (3)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Fileless Malware — Startup Persistence Backdoor**<br>`fileless-malware-startup-persistence` | advanced | 25 | True positive | `T1059.001`, `T1547.001`, `T1071.001` |
| **Malware — DNS Tunneling Command-and-Control and Exfiltration**<br>`dns-tunneling-data-exfiltration` | advanced | 30 | True positive | `T1204.002`, `T1071.004`, `T1041` |
| **Malware — Trojanized Installer with Scheduled Task Persistence**<br>`malware-trojan-installer-scheduled-task` | advanced | 25 | True positive | `T1204.002`, `T1053.005`, `T1071.001` |

### Ransomware (2)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Ransomware — Data Theft Before Encryption**<br>`ransomware-double-extortion-data-theft` | advanced | 25 | True positive | `T1048`, `T1486` |
| **Ransomware — Lateral Movement & Mass Encryption**<br>`ransomware-lateral-movement-encryption` | advanced | 30 | True positive | `T1021.002`, `T1486` |

### Cloud (3)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Cloud — Storage Bucket Exposed to Public Access**<br>`cloud-storage-bucket-public-exposure` | intermediate | 20 | True positive | `T1530` |
| **Cloud Account Takeover — Malicious Access Key Creation**<br>`cloud-account-takeover-access-key` | intermediate | 25 | True positive | `T1098.001`, `T1530` |
| **Cloud — OAuth Illicit Consent Grant via Phishing**<br>`oauth-illicit-consent-grant-phishing` | advanced | 30 | True positive | `T1566.002`, `T1528`, `T1114.002` |

### Web application (6)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Web — Uptime Monitor Flagged as a Web Shell**<br>`monitoring-agent-flagged-as-webshell` | beginner | 15 | False positive | — *(no attack to tag)* |
| **Web — Customer Records Reached by Changing an ID**<br>`idor-invoice-enumeration` | intermediate | 25 | True positive | `T1213` |
| **Web — Reporting Job Flagged as Record Enumeration**<br>`batch-export-mistaken-for-enumeration` | intermediate | 20 | False positive | — *(no attack to tag)* |
| **Web — SQL Injection Data Exfiltration**<br>`web-sql-injection-data-exfiltration` | advanced | 25 | True positive | `T1190` |
| **Web — SQL Injection Escalated to a Web Shell**<br>`sql-injection-to-webshell-chain` | advanced | 35 | True positive | `T1190`, `T1505.003` |
| **Web Shell Access on Public-Facing Server**<br>`web-shell-public-facing-server` | advanced | 25 | True positive | `T1505.003` |

### Insider threat (3)

| Scenario | Difficulty | Mins | Correct verdict | Required techniques |
| --- | --- | ---: | --- | --- |
| **Insider Threat — Data Exfiltration to Personal Email**<br>`insider-data-exfiltration` | beginner | 15 | True positive | `T1048` |
| **Insider Threat — Bulk File Copy to Removable Media**<br>`insider-bulk-usb-copy-resignation` | intermediate | 20 | True positive | `T1052.001`, `T1070.004` |
| **Insider Threat — Departing Engineer Bulk-Downloads Cloud Storage**<br>`departing-engineer-bulk-cloud-download` | advanced | 25 | True positive | `T1530`, `T1070.004` |

<!-- END GENERATED: scenario-tables -->

## MITRE coverage

31 distinct ATT&CK techniques are required across the catalogue. Technique tagging is graded on
both precision and recall — tagging every plausible technique to cover yourself scores worse
than tagging only what the evidence supports.

Coverage is queryable at runtime: `GET /mitre/techniques` returns the platform's technique
reference, and a student's own mastery per technique comes from
`GET /sessions/technique-mastery`.

## Adding a scenario

1. Add the definition to `apps/api/prisma/seed.ts`.
2. Every `event_template` its kill chain names must already exist in
   `apps/api/src/modules/telemetry-generator/generator.ts` — see
   [EVENT-CATALOG.md](EVENT-CATALOG.md#event-templates). A scenario cannot introduce a new
   *kind* of telemetry on its own; it composes templates that already exist.
3. Run `npm run prisma:seed`. Seeding is version-aware: it compares canonical JSON and only
   creates a new `ScenarioVersion` when the definition actually changed, so re-seeding
   unchanged scenarios is a no-op and in-flight sessions keep the version they started on.
