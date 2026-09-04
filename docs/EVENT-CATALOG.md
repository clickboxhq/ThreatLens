# Event catalogue

**As-built.** Derived from `apps/api/prisma/schema.prisma` and
`apps/api/src/modules/telemetry-generator/generator.ts`.

Every investigation runs against synthetic telemetry generated per session from a seed. Nothing
is pre-baked and shared between students: two people running the same scenario get the same
narrative over different entities, hostnames, IPs and timestamps.

## The eight telemetry tables

Each table is one log source, reached through its own portal endpoint. There is no single
unified "search all telemetry" stream — an analyst pivots between sources the way they would
between real consoles.

| Table | Represents | Fields | Portal |
| --- | --- | ---: | --- |
| `sign_in_events` | Authentication attempts — success, failure, MFA result, client app, location | 21 | Identity Center |
| `process_events` | Process creation with parent/child lineage and command lines | 18 | Device Center |
| `file_events` | File create / modify / delete / copy, including removable media | 13 | Device Center |
| `network_events` | Outbound and inbound connections, DNS, HTTP requests | 18 | Network Center |
| `cloud_events` | Control-plane API actions — IAM, storage, OAuth consent | 14 | Cloud events |
| `http_requests` | Web server requests — method, URL, user agent, status | 16 | Log Explorer |
| `email_messages` | Mailbox contents with full headers, SPF/DKIM/DMARC, attachments | 21 | Email Investigation |
| `directory_audit_events` | Directory changes — group membership, role assignment, policy edits | 17 | Identity Center |

### The three columns that never reach a browser

Every one of those tables carries the same three answer-key columns:

| Column | Why it is the answer |
| --- | --- |
| `is_ground_truth_evidence` | Marks a row as part of the real attack — pinning exactly these is 30% of the grade |
| `mitre_technique_id` | The technique the row demonstrates — another 30% of the grade |
| `correlation_id` | Which causal chain the row belongs to — reveals the attack's shape |

They are stripped by an allow-list DTO layer (`apps/api/src/common/dto/*.dto.ts`) before
anything is serialised. See [PLATFORM.md](PLATFORM.md#the-ground-truth-boundary) for why the
allow-list direction matters.

## Event templates

52 templates in `generator.ts`. A template is the unit a scenario's kill chain composes: it
knows how to materialise one narrative beat — a phishing email, a lateral-movement logon, a
mass-encryption burst — into concrete rows across the right tables, with the ground-truth
columns set.

Templates group into families:

| Family | Templates | Examples |
| --- | ---: | --- |
| Web | 6 | SQL injection, web shell access, IDOR enumeration |
| Cloud | 4 | Access-key creation, bucket exposure |
| OAuth | 3 | Illicit consent grant and follow-on mailbox access |
| Malicious activity | 3 | Attachment execution, C2 callback |
| **Legitimate activity** | 3 | Batch export, uptime monitoring, genuine vendor mail |
| Legacy auth | 3 | Basic-auth sign-in bypassing enforced MFA |
| Insider | 3 | USB copy, personal-webmail send, bulk cloud download |
| DNS | 3 | Tunnelling, high-frequency lookups |
| Credential attacks | 4 | Password spray, brute force, credential stuffing, MFA fatigue |
| Others | 20 | Ransomware, Kerberoasting, LSASS dumping, persistence, BEC |

The `legitimate_*` and `benign_*` families exist so a scenario can raise a real alert on
activity that turns out to be authorised. Without them the platform could only teach
"everything that alerts is an attack."

**A scenario cannot invent telemetry.** Its kill chain references templates by id; adding a
genuinely new attack shape means adding a template first.

## Detection rules

20 rules in `apps/api/src/modules/alert-engine/rules.ts` run over the generated telemetry and
produce the alerts a student starts from. Rules read the same rows a student can see — they
never consult `is_ground_truth_evidence`, which is what allows a rule to fire on innocent
activity and produce a genuine false positive.

**Identity**
- Sign-in From New Country
- Password Spray Campaign Detected
- MFA Fatigue Pattern Detected
- Impossible Travel Detected
- Legacy Authentication Bypassed Enforced MFA

**Device**
- Office Application Spawned a Script Interpreter
- Remote Service Execution Consistent with Lateral Movement
- Mass File Encryption Detected
- Persistence Artifact Written to Startup Location
- LSASS Memory Access via comsvcs.dll
- Bulk File Copy to Removable Media
- Scheduled Task Created for Persistence
- Kerberoasting Ticket Request Detected
- High-Frequency DNS Traffic to a Single External Address

**Email**
- SPF Fail with Lookalike Sender Domain
- Outbound Message to Personal Webmail with Attachment

**Cloud**
- Sensitive API Action Detected
- Suspicious OAuth App Consent Followed by Mailbox Access

**Web**
- Non-Browser Client Accessed a Script Path
- SQL Injection Payload Detected

Thresholds are constants in the same file — for example impossible travel triggers above
900 km/h implied speed, password spray at 5 distinct identities, mass encryption at 5 files
inside 15 minutes.
