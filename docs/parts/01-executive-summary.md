# 1. Executive Summary

## 1.1 Product Vision

ThreatLens is a cloud-native, proprietary cybersecurity training platform that reproduces the day-to-day experience of working inside a modern Security Operations Center (SOC). Where existing training products rely on video lectures, multiple-choice quizzes, or static "capture the flag" challenges, ThreatLens instead places the learner inside a fully interactive, purpose-built investigation environment that looks, feels, and behaves like the enterprise security tooling professionals use in production: an alert queue, an incident workbench, an identity investigation console modeled conceptually on Microsoft Entra ID, an endpoint console modeled conceptually on Microsoft Defender for Endpoint, and an email investigation console modeled conceptually on Microsoft Defender for Office 365 / Outlook.

Critically, ThreatLens is **not** a SIEM, and it does not ingest, store, or process any real customer telemetry. It is a closed-loop educational simulator: the platform itself generates synthetic but statistically and behaviorally realistic telemetry (sign-in logs, process trees, DNS queries, email headers, firewall events, etc.), embeds a hidden "ground truth" attack narrative inside that telemetry, and then challenges the learner to reconstruct that narrative through investigation — exactly as a real analyst would reconstruct an attacker's actions from log data. The backend already knows the answer. The learner's job is to find it, document it, and defend their conclusion. This is the same operating model as a flight simulator: the aircraft never actually leaves the ground, but the controls, the failure conditions, and the consequences of a wrong decision are real enough to build genuine muscle memory and judgment.

This document is the full software architecture and technical design specification for ThreatLens. It is written so that an engineering team — or an AI coding agent — can implement the platform from an empty repository without having to make architectural guesses. Every service, data model, API contract, and infrastructure decision described here is intended to be treated as authoritative unless a future decision explicitly supersedes it.

## 1.2 Why ThreatLens Exists

The cybersecurity industry has a well-documented and persistent workforce gap: industry estimates have placed the global shortage of security professionals at several million unfilled roles for multiple consecutive years, and the entry-level SOC analyst (Tier 1) role is simultaneously the highest-turnover and highest-demand position in the field. The core problem is not a lack of course material — there is no shortage of certifications, video courses, or written material explaining what phishing, lateral movement, or impossible travel are in the abstract. The problem is that almost none of that material gives a learner hands-on repetitions of the actual *investigative workflow*: opening an alert, pivoting from a sign-in event to a device, from a device to a process tree, from a process tree to a file hash, correlating that hash against threat intelligence, and writing up a defensible incident conclusion under time pressure and incomplete information.

Existing hands-on options fall short in specific, addressable ways:

- **Real SIEM trial/sandbox environments** (e.g., a Sentinel or Splunk trial workspace) require the learner to also learn a general-purpose, enterprise-grade query language and administrative console before they can practice investigation skills at all. They are also expensive to operate at scale for a training vendor, since real SIEM licensing and compute costs scale with data ingested.
- **Capture-the-flag (CTF) platforms** teach exploitation and offensive skills, not defensive triage and investigation. The "find the flag" objective structure does not match the "determine whether this is malicious, and if so, what happened" objective structure of SOC work.
- **Video-based certification prep** builds vocabulary and conceptual knowledge but produces no evidence that the learner can actually perform an investigation, because there is no interactive investigation to perform.
- **Static screenshot-based walkthroughs** cannot adapt, cannot be graded programmatically, and cannot vary between attempts, so they are trivially memorized rather than learned.

ThreatLens is designed to fill exactly this gap: a scenario-driven, professionally faithful, infinitely repeatable investigation simulator, delivered as a subscription SaaS product, that can plausibly replace (or meaningfully supplement) the hands-on-labs component of SOC analyst training programs, university cybersecurity programs, corporate blue-team upskilling programs, and individual certification study plans.

## 1.3 Market Opportunity

The addressable market spans several buyer segments, each with a distinct purchasing motion:

| Segment | Buyer | Motion | Notes |
|---|---|---|---|
| Individual learners / career changers | Self-pay, monthly or annual subscription | Direct-to-consumer, content marketing + SEO + community | Comparable in spirit to TryHackMe/LetsDefend pricing bands |
| Bootcamps & universities | Program directors, department budgets | Seat-based licensing, per-cohort pricing | Requires Instructor Mode, class rosters, grading exports |
| Corporate security teams | SOC managers, L&D budgets | Team seats, SSO, usage reporting for compliance training credit | Requires SSO, audit logs, admin reporting |
| MSSPs training new analysts | Ops managers | Bulk seats tied to onboarding pipelines | Requires fast onboarding, scenario assignment automation |

Direct competitors and adjacent products (LetsDefend, TryHackMe's SOC-Level content, CyberDefenders, RangeForce, Immersive Labs) validate demand for this category but each has gaps ThreatLens is designed to exploit: most are narrowly focused on a single investigation surface (usually just a log search interface), few offer a multi-console experience spanning identity, endpoint, and email simultaneously the way a real Tier 1/Tier 2 analyst's day actually spans those surfaces, and few are built with a scenario engine flexible enough to support instructor-authored custom content — which is the feature that unlocks the B2B education and enterprise segments, not just the B2C segment.

## 1.4 Target Users

- **Aspiring SOC analysts** with little to no professional experience, using ThreatLens to build a portfolio of demonstrable investigation reps before applying for Tier 1 roles.
- **Junior analysts (0–2 years)** looking to accelerate past Tier 1 pattern-matching into genuine investigative reasoning, and to practice attack types their current employer hasn't yet exposed them to (e.g., BEC, ransomware precursors).
- **Career changers** (IT support, sysadmins, military/veterans transitioning to cyber) who have adjacent technical literacy but no security-specific investigative experience.
- **University and bootcamp instructors** who need a gradable, reusable lab environment instead of building one-off labs by hand each term.
- **Corporate blue teams** running internal tabletop and upskilling exercises, particularly around a new attack technique or after a real incident post-mortem ("let's make sure the whole team can recognize this pattern").

## 1.5 Product Principles

1. **Fidelity without dependency.** The platform must *feel* like Sentinel/Defender/Splunk in its investigative ergonomics — because that ergonomic fluency is the actual skill being taught — while remaining 100% proprietary in implementation. No vendor SIEM, EDR, or identity product is embedded, wrapped, or resold. See §1.6.
2. **Ground truth first.** Every scenario is authored backwards from a known attacker narrative (a MITRE ATT&CK-mapped kill chain) into synthetic telemetry, never forwards from telemetry into an ambiguous guess. This is what makes automated, objective grading possible (§12).
3. **Investigation, not search-box trivia.** The grading model rewards correct *conclusions* reached via a defensible evidence trail, not merely finding a keyword. Partial credit, hint costs, and false-positive penalties are first-class scoring concepts (§6.14, §12).
4. **Cost-conscious by default.** As a bootstrapped/early-stage product, every infrastructure choice defaults to the cheapest option that does not compromise the learning experience, with an explicit, pre-planned upgrade path as revenue grows (§19, §20).
5. **Content is the moat.** The scenario library, the realism of the synthetic telemetry, and the instructor tooling are the durable competitive advantages — not any single UI screen. Architecture decisions throughout this document are made to keep scenario authoring cheap and scenario variety high.

## 1.6 Explicitly Not a SIEM

This distinction is architecturally load-bearing and is repeated here because it shapes almost every downstream decision in this document:

- ThreatLens does not accept customer-supplied log data of any kind. There is no "connect your data source" feature. All telemetry is synthetic, generated by the platform itself (§7).
- ThreatLens does not implement a general-purpose query language, a rules-as-code detection authoring surface for end users, or a data-ingestion pipeline sized for real enterprise log volume. The "Search" and "Global Timeline" features (§2) are investigation conveniences scoped to a single scenario's dataset (typically thousands, not billions, of events), not a big-data analytics product.
- ThreatLens's "Identity Portal," "Device Portal," and "Email Portal" are **inspired by** the information architecture of Entra ID, Defender for Endpoint, and Outlook/Defender for Office 365 so that the investigative *muscle memory* transfers to real tools — but every field, screen, and API in this document is an original design, backed by ThreatLens's own database schema (§6), not a clone of any vendor's UI, code, or protected trade dress.

## 1.7 Commercial Vision

**Phase 1 (MVP, months 0–6):** Single-tenant-per-user SaaS, individual subscriptions only, a curated library of 15–25 hand-authored scenarios spanning the attack categories in §1.8, delivered on the lean single-VPS deployment described in §19. Goal: prove that the investigation experience is compelling enough to retain paying individual subscribers month over month, and start generating the usage data needed to tune the scoring engine.

**Phase 2 (months 6–14):** Instructor Mode, classroom/cohort seat licensing, scenario assignment and grading export, SSO for institutional buyers, and a self-service scenario authoring tool so power users and partner instructors can contribute scenarios (curated, not fully open marketplace yet). Infrastructure migrates toward the managed-Postgres/Kubernetes-readiness path described in §19.3.

**Phase 3 (14+ months):** Enterprise team seats with admin reporting suitable for compliance/training-credit purposes, AI Investigation Assistant and AI-authored scenario variation (§14) to scale content production, and a scenario marketplace with revenue share for community-authored content. Full Kubernetes, multi-region, and HA posture (§19.4) is justified by this point by actual paid load.

Revenue model: monthly/annual subscription tiers for individuals (Free trial → Pro), per-seat annual licensing for institutions/enterprises, and an optional one-time "certification exam attempt" product (a proctored, higher-stakes scenario battery) as a longer-term upsell once the core product and content library are proven.

## 1.8 Attack Coverage at Launch

The scenario library (§12) must, at MVP, include working, gradable scenarios for each of the following investigation domains, each mapped to relevant MITRE ATT&CK techniques (§6, `mitre_techniques` table):

- Microsoft Entra ID–style identity investigations (conditional access anomalies, risky sign-ins)
- Microsoft Defender–style endpoint investigations (process trees, persistence artifacts)
- Email phishing investigations (headers, SPF/DKIM/DMARC, malicious attachments/URLs)
- General endpoint investigations (malware execution, USB exfiltration)
- Authentication investigations (credential misuse, session hijacking)
- Cloud investigations (IaaS/SaaS control-plane misuse, storage exposure)
- Insider threat investigations (anomalous data access by legitimate credentials)
- Web attack investigations (web shell deployment, injection-driven compromise)
- Malware investigations (execution chain, C2 beaconing)
- Ransomware investigations (encryption precursors, lateral spread, exfil-before-encrypt)
- Lateral movement (MITRE TA0008)
- Persistence (MITRE TA0003)
- Privilege escalation (MITRE TA0004)
- Impossible travel
- Password spraying
- MFA bypass / MFA fatigue
- Business Email Compromise (BEC)
- Data exfiltration

Each of these is not necessarily a separate scenario — a well-authored ransomware scenario, for example, naturally exercises initial access, privilege escalation, lateral movement, and persistence in one narrative — but each must be independently *assessable*, meaning the scoring engine (§6.14, §12.4) must be able to tell whether the learner correctly identified each technique present, not just whether they reached the final "this was ransomware" verdict.
