// Reference data + the scenario library (docs/SOCVerse-Architecture.md §12.1, §12.6).
// Idempotent: safe to re-run against the same database.

import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const MITRE_TECHNIQUES = [
  {
    techniqueId: 'T1566.002',
    name: 'Phishing: Spearphishing Link',
    tactic: 'TA0001',
    description:
      'Adversaries send emails containing malicious links to gain access to victim systems, typically to harvest credentials via a lookalike login page.',
    url: 'https://attack.mitre.org/techniques/T1566/002/',
  },
  {
    techniqueId: 'T1078',
    name: 'Valid Accounts',
    tactic: 'TA0001',
    description:
      'Adversaries obtain and abuse credentials of existing accounts to gain initial access, persistence, or privilege escalation.',
    url: 'https://attack.mitre.org/techniques/T1078/',
  },
  {
    techniqueId: 'T1566.001',
    name: 'Phishing: Spearphishing Attachment',
    tactic: 'TA0001',
    description: 'Adversaries send emails with malicious attachments to gain access to victim systems.',
    url: 'https://attack.mitre.org/techniques/T1566/001/',
  },
  {
    techniqueId: 'T1110',
    name: 'Brute Force',
    tactic: 'TA0006',
    description: 'Adversaries use brute force techniques, including password spraying, to gain access to accounts.',
    url: 'https://attack.mitre.org/techniques/T1110/',
  },
  {
    techniqueId: 'T1110.003',
    name: 'Brute Force: Password Spraying',
    tactic: 'TA0006',
    description:
      'Adversaries use a single password (or small list) against many accounts to avoid account lockout, then attempt to use any credentials that succeed.',
    url: 'https://attack.mitre.org/techniques/T1110/003/',
  },
  {
    techniqueId: 'T1621',
    name: 'Multi-Factor Authentication Request Generation',
    tactic: 'TA0006',
    description: 'Adversaries repeatedly generate MFA push notifications to induce a user into approving one, bypassing MFA.',
    url: 'https://attack.mitre.org/techniques/T1621/',
  },
  {
    techniqueId: 'T1656',
    name: 'Impersonation',
    tactic: 'TA0005',
    description:
      'Adversaries impersonate a trusted individual or organization to persuade a target into taking an action, such as a fraudulent wire transfer — the core mechanism of Business Email Compromise.',
    url: 'https://attack.mitre.org/techniques/T1656/',
  },
  {
    techniqueId: 'T1048',
    name: 'Exfiltration Over Alternative Protocol',
    tactic: 'TA0010',
    description:
      'Adversaries (or insiders) move data out of an environment using a protocol other than the primary command-and-control channel — including ordinary outbound email to a personal account.',
    url: 'https://attack.mitre.org/techniques/T1048/',
  },
  {
    techniqueId: 'T1204.002',
    name: 'User Execution: Malicious File',
    tactic: 'TA0002',
    description:
      'An adversary relies on a user opening a malicious file (often a macro-enabled document) to gain code execution, typically spawning a script interpreter or shell as a child process.',
    url: 'https://attack.mitre.org/techniques/T1204/002/',
  },
  {
    techniqueId: 'T1071.001',
    name: 'Application Layer Protocol: Web Protocols',
    tactic: 'TA0011',
    description:
      'Adversaries use common web protocols (typically HTTPS on port 443) for command-and-control traffic so it blends in with legitimate outbound traffic.',
    url: 'https://attack.mitre.org/techniques/T1071/001/',
  },
  {
    techniqueId: 'T1021.002',
    name: 'Remote Services: SMB/Windows Admin Shares',
    tactic: 'TA0008',
    description:
      'Adversaries use valid accounts to interact with a remote host using Windows admin shares over SMB, commonly to install and run a temporary service (e.g. PsExec) as a means of lateral movement.',
    url: 'https://attack.mitre.org/techniques/T1021/002/',
  },
  {
    techniqueId: 'T1486',
    name: 'Data Encrypted for Impact',
    tactic: 'TA0040',
    description:
      'Adversaries encrypt data on target systems to interrupt availability, typically as the final stage of a ransomware attack.',
    url: 'https://attack.mitre.org/techniques/T1486/',
  },
  {
    techniqueId: 'T1114.002',
    name: 'Email Collection: Remote Email Collection',
    tactic: 'TA0009',
    description:
      'Adversaries with valid credentials access a mailbox remotely (e.g. via IMAP) to collect email content, often using legacy protocols that fall outside modern authentication controls.',
    url: 'https://attack.mitre.org/techniques/T1114/002/',
  },
];

const DETECTION_RULES = [
  {
    name: 'Email: SPF Fail with Lookalike Sender Domain',
    description:
      'Fires when an inbound message fails SPF authentication and the sender domain is a plausible lookalike of a known-good domain.',
    logicSummary:
      'spf_result = fail AND sender domain edit-distance to a known org domain is small AND message is inbound.',
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1566.002',
  },
  {
    name: 'Identity: Sign-in From New Country',
    description:
      'Fires when a successful sign-in occurs from a country not previously observed for that identity within the session window.',
    logicSummary:
      'result = success AND source_country not in the identity\'s prior observed source_country set for this session.',
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1078',
  },
  {
    name: 'Identity: Password Spray Campaign Detected',
    description:
      'Fires when one source IP produces failed sign-ins against several distinct identities within the session window.',
    logicSummary: 'count(DISTINCT identity_id) grouped by source_ip WHERE result = failure >= 5 within the session.',
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1110.003',
  },
  {
    name: 'Identity: MFA Fatigue Pattern Detected',
    description: 'Fires when one identity receives several MFA-denied results from one source IP in a short window.',
    logicSummary: 'count(result = mfa_denied) grouped by (identity_id, source_ip) >= 5 within the session.',
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1621',
  },
  {
    name: 'Identity: Impossible Travel Detected',
    description:
      "Fires when the implied speed between two consecutive successful sign-ins for the same identity exceeds feasible travel.",
    logicSummary: 'implied_speed_kmh(consecutive successful sign-ins for the same identity) >= 900 km/h.',
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1078',
  },
  {
    name: 'Email: Outbound Message to Personal Webmail with Attachment',
    description: 'Fires when an outbound message with at least one attachment is sent to a known personal webmail domain.',
    logicSummary: "direction = outbound AND has_attachment AND recipient domain IN (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com).",
    defaultSeverity: 'medium' as const,
    mitreTechniqueSlug: 'T1048',
  },
  {
    name: 'Device: Office Application Spawned a Script Interpreter',
    description: 'Fires when an Office application (Word, Excel, Outlook, PowerPoint) is the direct parent of a script interpreter or shell.',
    logicSummary: "parent process image IN (WINWORD.EXE, EXCEL.EXE, OUTLOOK.EXE, POWERPNT.EXE) AND child process image IN (powershell.exe, cmd.exe, wscript.exe, cscript.exe, mshta.exe).",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1204.002',
  },
  {
    name: 'Device: Remote Service Execution Consistent with Lateral Movement',
    description: 'Fires when PSEXESVC.exe — the artifact PsExec-style remote execution leaves on a target host — appears in a device process tree.',
    logicSummary: 'process image_path ends with PSEXESVC.exe.',
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1021.002',
  },
  {
    name: 'Device: Mass File Encryption Detected',
    description: 'Fires when a device accumulates several file-encrypted events within a short window.',
    logicSummary: 'count(file_events WHERE action = encrypted) grouped by device_id, occurring within a 15-minute rolling window >= 5.',
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1486',
  },
  {
    name: 'Identity: Legacy Authentication Bypassed Enforced MFA',
    description: 'Fires when a successful sign-in used a legacy authentication protocol on an identity whose MFA is enforced.',
    logicSummary: "result = success AND is_legacy_auth = true AND identity.mfa_status = 'enforced', grouped by identity.",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1078',
  },
];

interface ScenarioSeed {
  slug: string;
  title: string;
  summary: string;
  category: Prisma.AttackScenarioCreateInput['category'];
  difficulty: Prisma.AttackScenarioCreateInput['difficulty'];
  estimatedMinutes: number;
  groundTruthDefinition: Record<string, unknown>;
  requiredTechniques: string[];
  threatIntel: {
    indicatorType: Prisma.ThreatIntelIndicatorCreateManyInput['indicatorType'];
    value: string;
    reputation: Prisma.ThreatIntelIndicatorCreateManyInput['reputation'];
    actorAttribution?: string;
    context: string;
  }[];
}

async function seedScenario(
  seed: ScenarioSeed,
  systemAuthorId: string,
  techniqueBySlug: Map<string, string>,
): Promise<void> {
  const scenario = await prisma.attackScenario.upsert({
    where: { slug: seed.slug },
    update: {},
    create: {
      slug: seed.slug,
      title: seed.title,
      summary: seed.summary,
      category: seed.category,
      difficulty: seed.difficulty,
      estimatedMinutes: seed.estimatedMinutes,
      status: 'published',
      authorId: systemAuthorId,
    },
  });

  let version = await prisma.scenarioVersion.findFirst({
    where: { scenarioId: scenario.id, versionNumber: 1 },
  });
  if (!version) {
    version = await prisma.scenarioVersion.create({
      data: {
        scenarioId: scenario.id,
        versionNumber: 1,
        groundTruthDefinition: seed.groundTruthDefinition as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
        createdBy: systemAuthorId,
      },
    });
  }

  await prisma.attackScenario.update({
    where: { id: scenario.id },
    data: { currentVersionId: version.id },
  });

  for (const techniqueSlug of seed.requiredTechniques) {
    const mitreTechniqueId = techniqueBySlug.get(techniqueSlug)!;
    await prisma.scenarioTechnique.upsert({
      where: { scenarioVersionId_mitreTechniqueId: { scenarioVersionId: version.id, mitreTechniqueId } },
      update: {},
      create: { scenarioVersionId: version.id, mitreTechniqueId, isRequiredForFullCredit: true },
    });
  }

  const existingIndicators = await prisma.threatIntelIndicator.count({ where: { scenarioVersionId: version.id } });
  if (existingIndicators === 0 && seed.threatIntel.length > 0) {
    await prisma.threatIntelIndicator.createMany({
      data: seed.threatIntel.map((indicator) => ({ scenarioVersionId: version!.id, ...indicator })),
    });
  }

  console.log(`  scenario "${scenario.slug}" v${version.versionNumber}`);
}

async function main() {
  const techniqueBySlug = new Map<string, string>();
  for (const t of MITRE_TECHNIQUES) {
    const row = await prisma.mitreTechnique.upsert({
      where: { techniqueId: t.techniqueId },
      update: { name: t.name, tactic: t.tactic, description: t.description, url: t.url },
      create: t,
    });
    techniqueBySlug.set(t.techniqueId, row.id);
  }

  for (const rule of DETECTION_RULES) {
    const existing = await prisma.detectionRule.findFirst({ where: { name: rule.name } });
    const data = {
      name: rule.name,
      description: rule.description,
      logicSummary: rule.logicSummary,
      defaultSeverity: rule.defaultSeverity,
      mitreTechniqueId: techniqueBySlug.get(rule.mitreTechniqueSlug),
      isActive: true,
    };
    if (existing) {
      await prisma.detectionRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.detectionRule.create({ data });
    }
  }

  const systemAuthor = await prisma.user.upsert({
    where: { email: 'system@socverse.internal' },
    update: {},
    create: {
      email: 'system@socverse.internal',
      role: 'platform_admin',
      displayName: 'SOCVerse Content Team',
      status: 'active',
      emailVerifiedAt: new Date(),
    },
  });

  console.log('Seeding scenarios...');

  await seedScenario(
    {
      slug: 'phishing-stolen-credentials',
      title: 'Phishing → Stolen Credentials → Risky Sign-in',
      summary:
        'A finance employee received a suspicious email. Shortly after, their account signed in from an unusual location. Investigate the mailbox and identity to determine what happened.',
      category: 'email',
      difficulty: 'beginner',
      estimatedMinutes: 30,
      requiredTechniques: ['T1566.002', 'T1078'],
      groundTruthDefinition: {
        metadata: {
          category: 'email',
          difficulty: 'beginner',
          estimated_minutes: 30,
          narrative_summary:
            'A finance-department employee clicks a spearphishing link, enters their credentials on a lookalike login page, and the attacker uses the stolen credentials to sign in from an unfamiliar location shortly after.',
        },
        population: {
          narrative_identities: [
            {
              ref: 'victim_identity_1',
              attributes: { department: 'Finance', job_title: 'Accounts Payable Specialist', home_country: 'US' },
            },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'FIN-WKS-07', os_platform: 'windows' } }],
          decoy_population_size: { identities: 12, devices: 10 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1566.002',
            entity_ref: 'victim_identity_1',
            event_template_id: 'phishing_email_invoice_lookalike_login_v1',
            relative_timestamp: '+2h',
            correlation_group: 'phish-chain-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'risky_signin_new_country_v1',
            relative_timestamp: '+2h45m',
            correlation_group: 'phish-chain-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [
            { event_template_id: 'legitimate_travel_signin_v1', count: 1 },
            { event_template_id: 'benign_it_admin_email_v1', count: 2 },
          ],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1566.002', 'T1078'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          {
            unlock_cost_percent: 5,
            text: "Check the victim identity's mailbox for anything unusual received a few hours before the risky sign-in.",
          },
          { unlock_cost_percent: 10, text: 'Look closely at the sender domain and the authentication results on that email.' },
          {
            unlock_cost_percent: 15,
            text: "Compare the sign-in's source country against the identity's home country and recent sign-in history.",
          },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'domain',
          value: 'secure-invoice-portal-verify.com',
          reputation: 'malicious',
          actorAttribution: 'Unattributed phishing kit',
          context: 'Lookalike domain hosting a credential-harvesting login page impersonating an invoicing portal.',
        },
        {
          indicatorType: 'domain',
          value: 'contoso-finance.example.com',
          reputation: 'known_good',
          context: "The organization's legitimate finance portal domain, for comparison.",
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'password-spraying-campaign',
      title: 'Password Spraying Campaign',
      summary:
        'A burst of failed sign-ins hit multiple accounts from one external address overnight. Determine whether any account was actually compromised.',
      category: 'identity',
      difficulty: 'intermediate',
      estimatedMinutes: 25,
      requiredTechniques: ['T1110.003', 'T1078'],
      groundTruthDefinition: {
        metadata: {
          category: 'identity',
          difficulty: 'intermediate',
          estimated_minutes: 25,
          narrative_summary:
            'An external attacker sprays a small set of common passwords across many accounts from a single IP to avoid lockouts. Most attempts fail, but one account — reused/weak credentials — succeeds, and the attacker signs in.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Sales', job_title: 'Account Executive', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 18, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1110.003',
            entity_ref: 'victim_identity_1',
            event_template_id: 'password_spray_batch_v1',
            relative_timestamp: '+3h',
            correlation_group: 'spray-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'password_spray_success_signin_v1',
            relative_timestamp: '+3h20m',
            correlation_group: 'spray-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1110.003', 'T1078'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Search sign-in events by source IP — how many different accounts did it try?' },
          {
            unlock_cost_percent: 10,
            text: 'Most of the attempts from that address failed. Did any of them succeed? Check the results, not just the count.',
          },
          {
            unlock_cost_percent: 15,
            text: 'If one account did succeed, that identity needs a closer look — check their normal sign-in pattern.',
          },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'bec-wire-transfer-fraud',
      title: 'Business Email Compromise — Executive Wire Transfer Fraud',
      summary:
        'A Finance employee received two urgent emails, apparently from the CFO, requesting a same-day wire transfer. No credentials were involved — determine whether this is a real request.',
      category: 'email',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
      requiredTechniques: ['T1656'],
      groundTruthDefinition: {
        metadata: {
          category: 'email',
          difficulty: 'intermediate',
          estimated_minutes: 20,
          narrative_summary:
            "An attacker registers a domain that closely resembles the organization's own, impersonates the CFO by name and title, and pressures a Finance employee into an urgent, confidential wire transfer — no link, attachment, or credential theft involved.",
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Finance', job_title: 'Controller', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 12,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1656',
            entity_ref: 'victim_identity_1',
            event_template_id: 'bec_wire_transfer_request_v1',
            relative_timestamp: '+1h',
            correlation_group: 'bec-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1656',
            entity_ref: 'victim_identity_1',
            event_template_id: 'bec_wire_transfer_followup_v1',
            relative_timestamp: '+4h',
            correlation_group: 'bec-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.15,
          false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1656'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check the sender's actual domain closely against the organization's real domain." },
          { unlock_cost_percent: 10, text: 'Review the SPF/DKIM/DMARC authentication results on both emails.' },
          {
            unlock_cost_percent: 15,
            text: 'Notice the request explicitly asks for secrecy and urgency, with no phone verification offered — a classic BEC pattern, not ordinary phishing.',
          },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'domain',
          value: 'contoso-finance-exec.example.net',
          reputation: 'malicious',
          actorAttribution: 'Unattributed BEC actor',
          context: "Lookalike domain used to impersonate the organization's CFO in wire-transfer fraud attempts.",
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'mfa-fatigue-push-bombing',
      title: 'MFA Fatigue — Push Bombing',
      summary:
        'An engineer\'s phone lit up with a burst of MFA approval requests overnight, then one was approved. Determine whether the account was actually accessed.',
      category: 'identity',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
      requiredTechniques: ['T1621', 'T1078'],
      groundTruthDefinition: {
        metadata: {
          category: 'identity',
          difficulty: 'intermediate',
          estimated_minutes: 20,
          narrative_summary:
            'An attacker with a valid password (obtained elsewhere) repeatedly triggers MFA push notifications against one account, hoping the user approves one out of annoyance or confusion — then signs in once one is approved.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Engineering', job_title: 'Software Engineer', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 12, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1621',
            entity_ref: 'victim_identity_1',
            event_template_id: 'mfa_fatigue_batch_v1',
            relative_timestamp: '+2h',
            correlation_group: 'mfa-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'mfa_fatigue_success_signin_v1',
            relative_timestamp: '+2h30m',
            correlation_group: 'mfa-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1621', 'T1078'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Search sign-in events for this identity — how many MFA prompts were denied before one succeeded?' },
          { unlock_cost_percent: 10, text: 'Check whether the denied attempts and the eventual success share a source IP.' },
          { unlock_cost_percent: 15, text: 'A dozen denied prompts in minutes, from one address, is not normal user behavior — even if the final approval looks legitimate.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'impossible-travel',
      title: 'Impossible Travel',
      summary:
        'The same account signed in successfully from two cities less than an hour apart. Determine whether this is a compromised account or something benign.',
      category: 'identity',
      difficulty: 'beginner',
      estimatedMinutes: 15,
      requiredTechniques: ['T1078'],
      groundTruthDefinition: {
        metadata: {
          category: 'identity',
          difficulty: 'beginner',
          estimated_minutes: 15,
          narrative_summary:
            "An attacker signs in with a compromised credential from a distant location shortly after the legitimate user's own sign-in — the gap between the two locations is not physically travelable in the time available.",
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Legal', job_title: 'Compliance Analyst', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'impossible_travel_first_signin_v1',
            relative_timestamp: '+5h',
            correlation_group: 'travel-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'impossible_travel_second_signin_v1',
            relative_timestamp: '+5h45m',
            correlation_group: 'travel-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1078'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Look at this identity's sign-in timeline — do any two consecutive entries look geographically odd?" },
          { unlock_cost_percent: 10, text: 'Compare the time between the two sign-ins against how long that trip would actually take.' },
          { unlock_cost_percent: 15, text: "One of the noise sign-ins in this session is a slow, plausible trip — don't confuse it with the fast, implausible pair." },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'insider-data-exfiltration',
      title: 'Insider Threat — Data Exfiltration to Personal Email',
      summary:
        'A sales employee emailed a spreadsheet to a personal Gmail address late at night. Determine whether this is a policy violation worth escalating.',
      category: 'insider_threat',
      difficulty: 'beginner',
      estimatedMinutes: 15,
      requiredTechniques: ['T1048'],
      groundTruthDefinition: {
        metadata: {
          category: 'insider_threat',
          difficulty: 'beginner',
          estimated_minutes: 15,
          narrative_summary:
            'An employee emails a sensitive company file from their own corporate account to their personal webmail address. There is no external attacker and no spoofing — every authentication check on the message passes, because it genuinely was sent by the organization\'s own mail system on the employee\'s behalf.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Sales', job_title: 'Account Executive', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1048',
            entity_ref: 'victim_identity_1',
            event_template_id: 'insider_data_exfil_email_v1',
            relative_timestamp: '+20h',
            correlation_group: 'exfil-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: { signal_to_noise_ratio: 0.1, false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 1 }] },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1048'],
          required_verdict: 'true_positive',
          min_evidence_items: 1,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Search outbound email — where is company data actually going?' },
          { unlock_cost_percent: 10, text: 'Check the authentication results on the message closely — is this actually spoofed, or genuinely sent by the org?' },
          { unlock_cost_percent: 15, text: 'The timing of the message (late at night) and the destination domain matter as much as the content.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'malware-execution-via-attachment',
      title: 'Malware Execution via Email Attachment',
      summary:
        'An engineer opened an emailed "statement" document. Shortly after, something unusual started happening on their workstation. Investigate the mailbox and the device to determine what happened.',
      category: 'endpoint',
      difficulty: 'advanced',
      estimatedMinutes: 35,
      requiredTechniques: ['T1566.001', 'T1204.002', 'T1071.001'],
      groundTruthDefinition: {
        metadata: {
          category: 'endpoint',
          difficulty: 'advanced',
          estimated_minutes: 35,
          narrative_summary:
            'An attacker delivers a macro-enabled document disguised as a billing statement. When opened, the macro spawns PowerShell, which drops a payload to disk and establishes outbound command-and-control communication — the full kill chain from delivery, to execution, to persistence infrastructure, to C2.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Engineering', job_title: 'Software Engineer', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'ENG-WKS-12', os_platform: 'windows' } }],
          decoy_population_size: { identities: 12, devices: 10 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1566.001',
            entity_ref: 'victim_identity_1',
            event_template_id: 'malicious_attachment_email_v1',
            relative_timestamp: '+2h',
            correlation_group: 'malware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1204.002',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malicious_process_execution_v1',
            relative_timestamp: '+2h15m',
            correlation_group: 'malware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1071.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malicious_c2_beacon_v1',
            relative_timestamp: '+2h20m',
            correlation_group: 'malware-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.05,
          false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1566.001', 'T1204.002', 'T1071.001'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check the victim's mailbox for anything with an attachment received a few hours before the device activity." },
          { unlock_cost_percent: 10, text: "In the Device Portal, look at this device's process tree — is there anything unusual about what launched what?" },
          { unlock_cost_percent: 15, text: 'Once you find the suspicious process, check the Network tab for that device around the same time.' },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'domain',
          value: 'billing-statements-delivery.example.org',
          reputation: 'malicious',
          actorAttribution: 'Unattributed malware delivery infrastructure',
          context: 'Domain used to deliver macro-enabled documents that drop a PowerShell-based payload.',
        },
        {
          indicatorType: 'ip',
          value: '185.220.101.47',
          reputation: 'malicious',
          actorAttribution: 'Unattributed C2 infrastructure',
          context: 'Observed as a command-and-control destination for outbound beacon traffic on port 443.',
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'ransomware-lateral-movement-encryption',
      title: 'Ransomware — Lateral Movement & Mass Encryption',
      summary:
        'An IT admin account was used to reach a file server it normally has no business touching. Shortly after, files on that server started disappearing behind a new extension. Investigate both devices to determine what happened.',
      category: 'ransomware',
      difficulty: 'advanced',
      estimatedMinutes: 30,
      requiredTechniques: ['T1021.002', 'T1486'],
      groundTruthDefinition: {
        metadata: {
          category: 'ransomware',
          difficulty: 'advanced',
          estimated_minutes: 30,
          narrative_summary:
            'An attacker already holding a compromised IT admin credential uses it to connect over SMB to a file server, installs a temporary remote-execution service (PsExec-style) to run commands there, then encrypts a batch of shared files and drops a ransom note.',
        },
        population: {
          narrative_identities: [
            { ref: 'compromised_admin', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
          ],
          narrative_devices: [
            { ref: 'patient_zero_device', attributes: { hostname: 'IT-WKS-04', os_platform: 'windows' } },
            { ref: 'file_server_device', attributes: { hostname: 'FS-PROD-01', os_platform: 'windows' } },
          ],
          decoy_population_size: { identities: 10, devices: 10 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1021.002',
            entity_ref: 'compromised_admin',
            device_ref: 'patient_zero_device',
            event_template_id: 'lateral_movement_source_connection_v1',
            relative_timestamp: '+3h',
            correlation_group: 'ransomware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1021.002',
            entity_ref: 'compromised_admin',
            device_ref: 'file_server_device',
            event_template_id: 'lateral_movement_remote_exec_v1',
            relative_timestamp: '+3h5m',
            correlation_group: 'ransomware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1486',
            entity_ref: 'compromised_admin',
            device_ref: 'file_server_device',
            event_template_id: 'mass_file_encryption_v1',
            relative_timestamp: '+3h10m',
            correlation_group: 'ransomware-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1021.002', 'T1486'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check the file server's process tree — is there anything there that shouldn't be, given no one logs into that machine directly?" },
          { unlock_cost_percent: 10, text: 'PSEXESVC.exe is a well-known artifact of remote command execution tools. Where did the connection that led to it come from?' },
          { unlock_cost_percent: 15, text: "Look at the file server's File Timeline around the same time — how many files changed, and how fast?" },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'legacy-auth-mfa-bypass',
      title: 'Legacy Authentication Bypassing Enforced MFA',
      summary:
        "An account with MFA enforced kept signing in successfully through an old mail protocol that has never once prompted for a second factor. Determine whether that's a gap being exploited.",
      category: 'identity',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
      requiredTechniques: ['T1078', 'T1114.002'],
      groundTruthDefinition: {
        metadata: {
          category: 'identity',
          difficulty: 'intermediate',
          estimated_minutes: 20,
          narrative_summary:
            'An attacker holding a compromised credential signs in via IMAP4 — a legacy protocol that predates modern MFA challenges — bypassing the identity\'s enforced MFA policy entirely, then repeatedly syncs the mailbox to collect its contents over the following hour.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Finance', job_title: 'Financial Analyst', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 14, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1078',
            entity_ref: 'victim_identity_1',
            event_template_id: 'legacy_auth_bypass_signin_v1',
            relative_timestamp: '+4h',
            correlation_group: 'legacy-auth-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1114.002',
            entity_ref: 'victim_identity_1',
            event_template_id: 'legacy_auth_mailbox_collection_v1',
            relative_timestamp: '+4h10m',
            correlation_group: 'legacy-auth-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legacy_auth_benign_service_v1', count: 3 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1078', 'T1114.002'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this identity's MFA status, then look at its sign-in timeline for anything using an old-sounding client app." },
          { unlock_cost_percent: 10, text: 'A legacy protocol succeeding on an MFA-enforced account is the gap — Conditional Access policies have to explicitly block legacy auth, or it slips through.' },
          { unlock_cost_percent: 15, text: 'How many times did it happen, and over what span? A single sync looks different from a sustained collection pattern.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  console.log(
    `Seeded: ${MITRE_TECHNIQUES.length} MITRE techniques, ${DETECTION_RULES.length} detection rules, 9 scenarios.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
