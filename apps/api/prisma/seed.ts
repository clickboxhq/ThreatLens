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
  {
    techniqueId: 'T1098.001',
    name: 'Account Manipulation: Additional Cloud Credentials',
    tactic: 'TA0003',
    description:
      'Adversaries with control-plane access to a cloud account add a new set of credentials (e.g. an access key) to maintain access independent of the credential originally used.',
    url: 'https://attack.mitre.org/techniques/T1098/001/',
  },
  {
    techniqueId: 'T1530',
    name: 'Data from Cloud Storage Object',
    tactic: 'TA0009',
    description: 'Adversaries enumerate and access objects stored in cloud storage services to collect sensitive data.',
    url: 'https://attack.mitre.org/techniques/T1530/',
  },
  {
    techniqueId: 'T1505.003',
    name: 'Server Software Component: Web Shell',
    tactic: 'TA0003',
    description:
      'Adversaries upload a script to a publicly accessible web server that grants remote command execution, surviving as a durable backdoor into the server.',
    url: 'https://attack.mitre.org/techniques/T1505/003/',
  },
  {
    techniqueId: 'T1059.001',
    name: 'Command and Scripting Interpreter: PowerShell',
    tactic: 'TA0002',
    description:
      'Adversaries abuse PowerShell to execute commands and scripts, often with an obfuscated or Base64-encoded payload, without ever writing a traditional executable to disk.',
    url: 'https://attack.mitre.org/techniques/T1059/001/',
  },
  {
    techniqueId: 'T1547.001',
    name: 'Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder',
    tactic: 'TA0003',
    description:
      'Adversaries add a program to a startup location — such as the Startup folder or a registry Run key — so it executes automatically at every user logon, a simple and durable persistence mechanism.',
    url: 'https://attack.mitre.org/techniques/T1547/001/',
  },
  {
    techniqueId: 'T1003.001',
    name: 'OS Credential Dumping: LSASS Memory',
    tactic: 'TA0006',
    description:
      'Adversaries dump the memory of the LSASS process, which caches credential material, often using a living-off-the-land technique like rundll32.exe with comsvcs.dll\'s MiniDump export to avoid a dedicated dumping tool that antivirus would flag by name.',
    url: 'https://attack.mitre.org/techniques/T1003/001/',
  },
  {
    techniqueId: 'T1052.001',
    name: 'Exfiltration Over Physical Medium: Exfiltration over USB',
    tactic: 'TA0010',
    description: 'Adversaries or insiders copy data onto a removable USB drive to move it out of an environment without touching the network.',
    url: 'https://attack.mitre.org/techniques/T1052/001/',
  },
  {
    techniqueId: 'T1070.004',
    name: 'Indicator Removal: File Deletion',
    tactic: 'TA0005',
    description: 'Adversaries or insiders delete files to remove evidence of their activity from a system.',
    url: 'https://attack.mitre.org/techniques/T1070/004/',
  },
  {
    techniqueId: 'T1190',
    name: 'Exploit Public-Facing Application',
    tactic: 'TA0001',
    description:
      'Adversaries exploit a weakness in an Internet-facing application — such as a SQL injection vulnerability — to gain initial access or extract data directly from its backing database.',
    url: 'https://attack.mitre.org/techniques/T1190/',
  },
  {
    techniqueId: 'T1053.005',
    name: 'Scheduled Task/Job: Scheduled Task',
    tactic: 'TA0003',
    description:
      'Adversaries use the Windows Task Scheduler (schtasks.exe) to register a program to run on a schedule or at logon, surviving a reboot without needing a Startup-folder artifact.',
    url: 'https://attack.mitre.org/techniques/T1053/005/',
  },
  {
    techniqueId: 'T1528',
    name: 'Steal Application Access Token',
    tactic: 'TA0006',
    description:
      'Adversaries phish a user into granting a malicious OAuth application consent to access their account, obtaining a durable access token without ever needing the user\'s password.',
    url: 'https://attack.mitre.org/techniques/T1528/',
  },
  {
    techniqueId: 'T1558.003',
    name: 'Steal or Forge Kerberos Tickets: Kerberoasting',
    tactic: 'TA0006',
    description:
      'Adversaries request Kerberos service tickets (TGS) for accounts with a Service Principal Name, then attempt to crack the ticket\'s encrypted portion offline to recover the service account\'s plaintext password.',
    url: 'https://attack.mitre.org/techniques/T1558/003/',
  },
  {
    techniqueId: 'T1078.002',
    name: 'Valid Accounts: Domain Accounts',
    tactic: 'TA0001',
    description:
      'Adversaries obtain and abuse credentials for a domain or service account to gain access, persistence, or privilege escalation across a Windows domain environment.',
    url: 'https://attack.mitre.org/techniques/T1078/002/',
  },
  {
    techniqueId: 'T1071.004',
    name: 'Application Layer Protocol: DNS',
    tactic: 'TA0011',
    description:
      'Adversaries use the DNS protocol for command-and-control traffic, encoding data into queries and responses so it blends in with the DNS lookups every device on a network already generates.',
    url: 'https://attack.mitre.org/techniques/T1071/004/',
  },
  {
    techniqueId: 'T1041',
    name: 'Exfiltration Over C2 Channel',
    tactic: 'TA0010',
    description: 'Adversaries move stolen data out of an environment over the same channel already used for command-and-control, rather than a separate exfiltration-specific connection.',
    url: 'https://attack.mitre.org/techniques/T1041/',
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
  {
    name: 'Cloud: Sensitive API Action Detected',
    description: 'Fires when a cloud control-plane action from a sensitive, high-privilege set is observed.',
    logicSummary: "action_name IN (CreateAccessKey, PutBucketPolicy, DeleteTrail, DisableKey).",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1098.001',
  },
  {
    name: 'Web: Non-Browser Client Accessed a Script Path',
    description: 'Fires when a non-browser HTTP client repeatedly requests a script-extension path on a web server.',
    logicSummary: "user_agent starts with a known non-browser marker (curl/, python-requests/, Wget/, PowerShell/) AND url path ends with a script extension (.php, .asp, .aspx, .jsp), grouped by (device_id, url).",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1505.003',
  },
  {
    name: 'Device: Persistence Artifact Written to Startup Location',
    description: 'Fires when a file is created in a Startup-folder auto-run location on a device.',
    logicSummary: "action = created AND file_path contains '\\Start Menu\\Programs\\Startup\\'.",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1547.001',
  },
  {
    name: 'Device: LSASS Memory Access via comsvcs.dll',
    description: 'Fires when a process command line references both comsvcs.dll and MiniDump — a known LSASS credential-dumping technique.',
    logicSummary: "command_line contains 'comsvcs.dll' AND command_line contains 'minidump' (case-insensitive).",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1003.001',
  },
  {
    name: 'Device: Bulk File Copy to Removable Media',
    description: 'Fires when a device accumulates several file-created events on a removable-media drive letter within a short window.',
    logicSummary: "count(file_events WHERE action = created AND file_path starts with a removable-drive letter) grouped by device_id, within a 15-minute rolling window >= 5.",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1052.001',
  },
  {
    name: 'Web: SQL Injection Payload Detected',
    description: 'Fires when an HTTP request URL contains a recognizable SQL-injection payload marker.',
    logicSummary: "url (decoded) contains a known SQLi marker (boolean tautology, UNION SELECT, DROP TABLE, SLEEP()), grouped by device_id.",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1190',
  },
  {
    name: 'Device: Scheduled Task Created for Persistence',
    description: 'Fires when schtasks.exe runs with a /create argument.',
    logicSummary: "process image IN (SCHTASKS.EXE) AND command_line contains '/create'.",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1053.005',
  },
  {
    name: 'Cloud: Suspicious OAuth App Consent Followed by Mailbox Access',
    description: 'Fires when an identity consents to a third-party app, which then accesses several mail items shortly after.',
    logicSummary:
      "action_name = ConsentToApplication for an identity, followed within 45 minutes by >= 3 MailItemsAccessed actions from the same app (resource_id), grouped by identity.",
    defaultSeverity: 'high' as const,
    mitreTechniqueSlug: 'T1528',
  },
  {
    name: 'Device: Kerberoasting Ticket Request Detected',
    description: 'Fires when a process command line references known Kerberoasting tooling (Rubeus, or a PowerView-style "kerberoast" request).',
    logicSummary: "command_line (case-insensitive) contains 'rubeus' OR 'kerberoast'.",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1558.003',
  },
  {
    name: 'Device: High-Frequency DNS Traffic to a Single External Address',
    description: 'Fires when a device accumulates several DNS-port (53) network events to the same remote address.',
    logicSummary: "count(network_events WHERE remote_port = 53) grouped by (device_id, remote_ip) >= 8.",
    defaultSeverity: 'critical' as const,
    mitreTechniqueSlug: 'T1071.004',
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
      displayName: 'ThreatLens Content Team',
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

  await seedScenario(
    {
      slug: 'cloud-account-takeover-access-key',
      title: 'Cloud Account Takeover — Malicious Access Key Creation',
      summary:
        'A cloud identity that has never touched the console before suddenly created a new access key, then enumerated a sensitive storage bucket. Determine whether this account is compromised.',
      category: 'cloud',
      difficulty: 'intermediate',
      estimatedMinutes: 25,
      requiredTechniques: ['T1098.001', 'T1530'],
      groundTruthDefinition: {
        metadata: {
          category: 'cloud',
          difficulty: 'intermediate',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker holding a compromised cloud identity credential creates a new access key to establish durable, independent access to the account, then uses it to enumerate and read objects out of a sensitive storage bucket.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Cloud Platform Engineer', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1098.001',
            entity_ref: 'victim_identity_1',
            event_template_id: 'cloud_malicious_access_key_creation_v1',
            relative_timestamp: '+3h',
            correlation_group: 'cloud-takeover-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1530',
            entity_ref: 'victim_identity_1',
            event_template_id: 'cloud_bucket_enumeration_v1',
            relative_timestamp: '+3h10m',
            correlation_group: 'cloud-takeover-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1098.001', 'T1530'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Check the Identity Portal for this account\'s cloud activity — has it ever created an access key before?' },
          { unlock_cost_percent: 10, text: 'A new access key on its own is suspicious but not conclusive. What did that key get used for afterward?' },
          { unlock_cost_percent: 15, text: 'Look at which storage bucket was accessed and how many objects were touched in a short span.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'web-shell-public-facing-server',
      title: 'Web Shell Access on Public-Facing Server',
      summary:
        'A public web server started receiving scripted requests to a file no developer remembers deploying. Determine whether this is a web shell and what the attacker did with it.',
      category: 'web',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1505.003'],
      groundTruthDefinition: {
        metadata: {
          category: 'web',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker uploads a small PHP web shell to a public-facing web server (likely via an unpatched upload feature, outside this scenario\'s telemetry), then accesses it directly with a scripted, non-browser HTTP client — first to confirm it works, then to issue a burst of commands.',
        },
        population: {
          narrative_identities: [
            { ref: 'web_server_service_account', attributes: { department: 'IT', job_title: 'Service Account', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'web_server_device', attributes: { hostname: 'WEB-PROD-01', os_platform: 'linux' } }],
          decoy_population_size: { identities: 8, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1505.003',
            entity_ref: 'web_server_service_account',
            device_ref: 'web_server_device',
            event_template_id: 'web_webshell_initial_access_v1',
            relative_timestamp: '+4h',
            correlation_group: 'webshell-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1505.003',
            entity_ref: 'web_server_service_account',
            device_ref: 'web_server_device',
            event_template_id: 'web_webshell_command_burst_v1',
            relative_timestamp: '+4h5m',
            correlation_group: 'webshell-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'web_legitimate_monitoring_v1', count: 4, device_ref: 'web_server_device' }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1505.003'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Check this server\'s HTTP requests for anything hitting a path that looks out of place for the application.' },
          { unlock_cost_percent: 10, text: 'A monitoring script also uses a non-browser client here — look at the specific path being requested, not just the user agent.' },
          { unlock_cost_percent: 15, text: 'Once you find the suspicious path, how many requests hit it, and were any of them POSTs?' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'fileless-malware-startup-persistence',
      title: 'Fileless Malware — Startup Persistence Backdoor',
      summary:
        'An IT workstation ran an obfuscated PowerShell command with no matching download or email trigger, then a new shortcut appeared in its Startup folder. Investigate the device to determine what happened.',
      category: 'malware',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1059.001', 'T1547.001', 'T1071.001'],
      groundTruthDefinition: {
        metadata: {
          category: 'malware',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker with brief access to an IT workstation (the initial foothold happened outside this scenario\'s telemetry) runs a heavily obfuscated, Base64-encoded PowerShell command with no dropped executable — fileless execution that leaves no file-based artifact for traditional antivirus to catch. It then establishes persistence by writing a shortcut to the Startup folder, so the backdoor survives a reboot, and begins beaconing out to a remote command-and-control server.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'IT-WKS-11', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1059.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'fileless_powershell_backdoor_v1',
            relative_timestamp: '+2h',
            correlation_group: 'fileless-malware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1547.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malware_startup_persistence_v1',
            relative_timestamp: '+2h5m',
            correlation_group: 'fileless-malware-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1071.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malicious_c2_beacon_v1',
            relative_timestamp: '+2h10m',
            correlation_group: 'fileless-malware-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [{ event_template_id: 'legitimate_startup_shortcut_v1', count: 2, device_ref: 'victim_device_1' }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1059.001', 'T1547.001', 'T1071.001'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's Process Tree — is there anything unusual, even without an obvious email or download trigger?" },
          { unlock_cost_percent: 10, text: 'PowerShell with an -EncodedCommand argument hides its real behavior from a casual glance — that obfuscation is itself a signal.' },
          {
            unlock_cost_percent: 15,
            text: 'Check the File Timeline for anything written to a Startup folder, then the Network tab for outbound traffic around the same time — a legitimate app can also drop a Startup shortcut, so look at what the file actually is.',
          },
        ],
      },
      threatIntel: [
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
      slug: 'credential-dumping-lsass-comsvcs',
      title: 'Credential Dumping — LSASS Memory Access via comsvcs.dll',
      summary:
        'An IT administrator\'s workstation ran a command referencing a well-known technique for dumping credentials out of memory. Investigate the device to determine whether this is a real credential-theft attempt.',
      category: 'endpoint',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1003.001', 'T1071.001'],
      groundTruthDefinition: {
        metadata: {
          category: 'endpoint',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker with brief interactive access to an IT admin workstation (the initial foothold happened outside this scenario\'s telemetry) uses rundll32.exe together with comsvcs.dll\'s MiniDump export — a living-off-the-land technique that avoids a dedicated credential-dumping tool antivirus would flag by name — to dump the LSASS process\'s memory to disk, then attempts to move the resulting dump file off the device over an outbound connection.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'IT-WKS-07', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1003.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'credential_dumping_lsass_dump_v1',
            relative_timestamp: '+3h',
            correlation_group: 'lsass-dump-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1071.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malicious_c2_beacon_v1',
            relative_timestamp: '+3h5m',
            correlation_group: 'lsass-dump-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1003.001', 'T1071.001'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's Process Tree for anything invoking a system DLL in an unusual way." },
          { unlock_cost_percent: 10, text: '"comsvcs.dll" has a legitimate COM+ purpose, but its MiniDump export is a well-known way to dump another process\'s memory — what process is being targeted here?' },
          { unlock_cost_percent: 15, text: 'If credentials were successfully dumped, the attacker still needs to get the file off the device — check the Network tab around the same time.' },
        ],
      },
      threatIntel: [
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
      slug: 'insider-bulk-usb-copy-resignation',
      title: 'Insider Threat — Bulk File Copy to Removable Media',
      summary:
        'A sales employee copied a batch of sensitive company files to a removable drive, then deleted the originals. Determine whether this is a policy violation worth escalating.',
      category: 'insider_threat',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
      requiredTechniques: ['T1052.001', 'T1070.004'],
      groundTruthDefinition: {
        metadata: {
          category: 'insider_threat',
          difficulty: 'intermediate',
          estimated_minutes: 20,
          narrative_summary:
            'An employee copies a batch of sensitive shared files onto a removable USB drive, then deletes the original copies from the shared file server — an attempt to take data with them while covering the most obvious trace of having done so.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Sales', job_title: 'Account Executive', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'SLS-WKS-09', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1052.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'insider_bulk_usb_copy_v1',
            relative_timestamp: '+21h',
            correlation_group: 'usb-exfil-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1070.004',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'insider_source_file_cleanup_v1',
            relative_timestamp: '+21h5m',
            correlation_group: 'usb-exfil-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1052.001', 'T1070.004'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's File Timeline — is there a burst of file activity on a drive letter that isn't C:?" },
          { unlock_cost_percent: 10, text: 'A drive letter other than C: on a corporate workstation is usually removable media.' },
          { unlock_cost_percent: 15, text: 'Once you find the copies, check whether the original files were touched afterward — deleting the source is a common way to hide what was taken.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'cloud-storage-bucket-public-exposure',
      title: 'Cloud — Storage Bucket Exposed to Public Access',
      summary:
        'A cloud engineer\'s identity changed a storage bucket\'s access policy, and shortly after, that bucket was accessed heavily from an unfamiliar location. Determine what happened.',
      category: 'cloud',
      difficulty: 'intermediate',
      estimatedMinutes: 20,
      requiredTechniques: ['T1530'],
      groundTruthDefinition: {
        metadata: {
          category: 'cloud',
          difficulty: 'intermediate',
          estimated_minutes: 20,
          narrative_summary:
            'A cloud engineer\'s identity changes a sensitive storage bucket\'s access policy to make it publicly readable — whether an honest misconfiguration or a deliberate act isn\'t yet clear. Shortly after, that same identity\'s credentials are used to pull a large batch of objects out of the bucket from an unfamiliar location, distinct from the engineer\'s normal working pattern.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Cloud Platform Engineer', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1530',
            entity_ref: 'victim_identity_1',
            event_template_id: 'cloud_bucket_public_exposure_v1',
            relative_timestamp: '+4h',
            correlation_group: 'bucket-exposure-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1530',
            entity_ref: 'victim_identity_1',
            event_template_id: 'cloud_bucket_public_access_burst_v1',
            relative_timestamp: '+4h15m',
            correlation_group: 'bucket-exposure-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1530'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check the Identity Portal for this account's cloud activity — did a bucket's access policy change recently?" },
          { unlock_cost_percent: 10, text: 'A policy change on its own could be an honest mistake. What happened to that bucket afterward?' },
          { unlock_cost_percent: 15, text: 'Look at where the subsequent access came from — does it match this engineer\'s normal working pattern?' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'web-sql-injection-data-exfiltration',
      title: 'Web — SQL Injection Data Exfiltration',
      summary:
        'A public-facing web server received a burst of scripted requests with SQL-injection-shaped payloads, followed by one that looks like it worked. Determine what data may have been exposed.',
      category: 'web',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1190'],
      groundTruthDefinition: {
        metadata: {
          category: 'web',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker probes a public-facing web application\'s customer-lookup endpoint with a series of SQL-injection payloads — boolean tautologies, a time-based blind probe, a stacked DROP TABLE attempt — to find an unsanitized parameter, then, having found one, issues a UNION SELECT crafted to pull username, password hash, and SSN columns out of the underlying database directly through the HTTP response.',
        },
        population: {
          narrative_identities: [
            { ref: 'web_server_service_account', attributes: { department: 'IT', job_title: 'Service Account', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'web_server_device', attributes: { hostname: 'WEB-PROD-02', os_platform: 'linux' } }],
          decoy_population_size: { identities: 8, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1190',
            entity_ref: 'web_server_service_account',
            device_ref: 'web_server_device',
            event_template_id: 'web_sqli_probe_burst_v1',
            relative_timestamp: '+5h',
            correlation_group: 'sqli-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1190',
            entity_ref: 'web_server_service_account',
            device_ref: 'web_server_device',
            event_template_id: 'web_sqli_data_exfil_v1',
            relative_timestamp: '+5h10m',
            correlation_group: 'sqli-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'web_legitimate_monitoring_v1', count: 4, device_ref: 'web_server_device' }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1190'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: 'Check this server\'s HTTP requests for query parameters that look unusual, not just unusual paths.' },
          { unlock_cost_percent: 10, text: "Several requests with slightly different payloads to the same endpoint in a short window suggest probing for a weakness, not a single mistake." },
          { unlock_cost_percent: 15, text: 'A UNION SELECT payload naming specific column names is a strong sign the probing found something and the attacker moved to actually pulling data out.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'ransomware-double-extortion-data-theft',
      title: 'Ransomware — Data Theft Before Encryption',
      summary:
        'A workstation sent an unusually large volume of data to an external address, then files on it started disappearing behind a new extension. Investigate the device to determine what happened.',
      category: 'ransomware',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1048', 'T1486'],
      groundTruthDefinition: {
        metadata: {
          category: 'ransomware',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'An attacker with interactive access to a single workstation (the initial foothold happened outside this scenario\'s telemetry) stages and exfiltrates a large volume of data over an outbound connection before encrypting files on the same device — the "double extortion" pattern common to modern ransomware operations, where stolen data backs up the ransom demand even if backups make recovery possible without paying. Unlike a lateral-movement ransomware attack, this one plays out entirely on one device.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'IT-WKS-15', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1048',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'ransomware_data_staging_exfil_v1',
            relative_timestamp: '+2h',
            correlation_group: 'ransomware-2-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1486',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'mass_file_encryption_v1',
            relative_timestamp: '+2h20m',
            correlation_group: 'ransomware-2-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1048', 'T1486'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's File Timeline — is there a burst of files being encrypted?" },
          { unlock_cost_percent: 10, text: 'Ransomware operators increasingly steal data before they encrypt it, so the ransom demand still has leverage even if backups exist. Check the Network tab before the encryption started.' },
          { unlock_cost_percent: 15, text: 'An unusually large amount of data sent out, over several connections in a short window, is the signal to look for — not any one connection alone.' },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'ip',
          value: '193.106.31.98',
          reputation: 'malicious',
          actorAttribution: 'Unattributed ransomware data-staging infrastructure',
          context: 'Observed as the destination for a large outbound data transfer immediately preceding file encryption.',
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'malware-trojan-installer-scheduled-task',
      title: 'Malware — Trojanized Installer with Scheduled Task Persistence',
      summary:
        'An engineer ran an installer downloaded outside official channels. Shortly after, a new scheduled task appeared on the device. Investigate the device to determine what happened.',
      category: 'malware',
      difficulty: 'advanced',
      estimatedMinutes: 25,
      requiredTechniques: ['T1204.002', 'T1053.005', 'T1071.001'],
      groundTruthDefinition: {
        metadata: {
          category: 'malware',
          difficulty: 'advanced',
          estimated_minutes: 25,
          narrative_summary:
            'A user runs an installer downloaded from outside official channels, disguised as a routine software update. The installer drops a second executable, which then registers itself as a scheduled task so it survives a reboot — a persistence mechanism distinct from a Startup-folder shortcut — and begins beaconing out to a remote command-and-control server.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Engineering', job_title: 'Software Engineer', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'ENG-WKS-21', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1204.002',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'trojan_installer_execution_v1',
            relative_timestamp: '+1h',
            correlation_group: 'trojan-installer-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1053.005',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malware_scheduled_task_persistence_v1',
            relative_timestamp: '+1h2m',
            correlation_group: 'trojan-installer-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1071.001',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'malicious_c2_beacon_v1',
            relative_timestamp: '+1h10m',
            correlation_group: 'trojan-installer-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [{ event_template_id: 'legitimate_startup_shortcut_v1', count: 2, device_ref: 'victim_device_1' }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1204.002', 'T1053.005', 'T1071.001'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's Process Tree — is there an installer that dropped and launched a second program?" },
          { unlock_cost_percent: 10, text: 'schtasks.exe with a /create argument registers a new scheduled task — a persistence mechanism just as durable as a Startup-folder shortcut, but in a different place.' },
          { unlock_cost_percent: 15, text: 'Once you find the dropped payload, check the Network tab for that device around the same time as the scheduled task creation.' },
        ],
      },
      threatIntel: [
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
      slug: 'oauth-illicit-consent-grant-phishing',
      title: 'Cloud — OAuth Illicit Consent Grant via Phishing',
      summary:
        'An HR employee received an email urging them to reconnect their mailbox through a third-party app. Shortly after, that app began pulling a large volume of mail. Determine what happened.',
      category: 'cloud',
      difficulty: 'advanced',
      estimatedMinutes: 30,
      requiredTechniques: ['T1566.002', 'T1528', 'T1114.002'],
      groundTruthDefinition: {
        metadata: {
          category: 'cloud',
          difficulty: 'advanced',
          estimated_minutes: 30,
          narrative_summary:
            'An attacker sends a phishing email urging the recipient to "reconnect" their mailbox by granting a third-party app permission to read it. Unlike a credential-harvesting phish, the victim never types a password — clicking through and approving the consent prompt hands the attacker a durable API access token directly. The attacker\'s infrastructure then uses that token to pull a large volume of mail out of the mailbox via the app\'s own API access, with no further sign-in ever required.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Human Resources', job_title: 'HR Generalist', home_country: 'US' } },
          ],
          narrative_devices: [],
          decoy_population_size: { identities: 10, devices: 6 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1566.002',
            entity_ref: 'victim_identity_1',
            event_template_id: 'oauth_consent_phishing_email_v1',
            relative_timestamp: '+3h',
            correlation_group: 'oauth-consent-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1528',
            entity_ref: 'victim_identity_1',
            event_template_id: 'oauth_illicit_consent_grant_v1',
            relative_timestamp: '+3h10m',
            correlation_group: 'oauth-consent-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1114.002',
            entity_ref: 'victim_identity_1',
            event_template_id: 'oauth_app_mailbox_exfil_v1',
            relative_timestamp: '+3h15m',
            correlation_group: 'oauth-consent-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1566.002', 'T1528', 'T1114.002'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this identity's mailbox for a message urging them to reconnect or re-authorize something." },
          { unlock_cost_percent: 10, text: 'In the Identity Portal, check this account\'s cloud activity for an app consent action — no password is needed for this technique, so look past sign-ins.' },
          { unlock_cost_percent: 15, text: 'Once an app is granted consent, check what that same app did afterward — and from where.' },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'domain',
          value: 'app-reconnect-office365-verify.com',
          reputation: 'malicious',
          actorAttribution: 'Unattributed OAuth-phishing infrastructure',
          context: 'Domain used to deliver a phishing link to a fraudulent OAuth app consent page.',
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'kerberoasting-service-account-pivot',
      title: 'Endpoint — Kerberoasting for Service Account Compromise',
      summary:
        'An IT admin workstation ran a tool that requests Kerberos service tickets in bulk. Some time later, a service account signed in from an unfamiliar location. Investigate to determine what happened.',
      category: 'endpoint',
      difficulty: 'advanced',
      estimatedMinutes: 30,
      requiredTechniques: ['T1558.003', 'T1078.002'],
      groundTruthDefinition: {
        metadata: {
          category: 'endpoint',
          difficulty: 'advanced',
          estimated_minutes: 30,
          narrative_summary:
            'An attacker with brief interactive access to an IT admin workstation (the initial foothold happened outside this scenario\'s telemetry) runs a well-known Kerberoasting tool to request service tickets for every account with a Service Principal Name, then takes the tickets offline to crack at their own pace. Some time later, the compromised service account\'s credentials are used to sign in from a location inconsistent with its normal, automated behavior.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
            { ref: 'service_account_identity_1', attributes: { department: 'IT', job_title: 'Service Account', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'IT-WKS-11', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1558.003',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'kerberoasting_tgs_request_v1',
            relative_timestamp: '+5h',
            correlation_group: 'kerberoast-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1078.002',
            entity_ref: 'service_account_identity_1',
            event_template_id: 'risky_signin_new_country_v1',
            relative_timestamp: '+5h30m',
            correlation_group: 'kerberoast-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.1,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 2 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1558.003', 'T1078.002'],
          required_verdict: 'true_positive',
          min_evidence_items: 2,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's Process Tree for a tool requesting Kerberos tickets in bulk." },
          { unlock_cost_percent: 10, text: 'Requesting service tickets for every account with a Service Principal Name lets an attacker crack their passwords offline, away from any lockout policy.' },
          { unlock_cost_percent: 15, text: 'Once you find the ticket request, check the Identity Portal for any service account signing in somewhere unusual afterward.' },
        ],
      },
      threatIntel: [],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedScenario(
    {
      slug: 'dns-tunneling-data-exfiltration',
      title: 'Malware — DNS Tunneling Command-and-Control and Exfiltration',
      summary:
        'A marketing workstation ran a downloaded "network utility." Shortly after, the device began sending an unusually high volume of DNS traffic to one external address. Investigate the device to determine what happened.',
      category: 'malware',
      difficulty: 'advanced',
      estimatedMinutes: 30,
      requiredTechniques: ['T1204.002', 'T1071.004', 'T1041'],
      groundTruthDefinition: {
        metadata: {
          category: 'malware',
          difficulty: 'advanced',
          estimated_minutes: 30,
          narrative_summary:
            'A user runs a downloaded utility disguised as a network diagnostics tool. It establishes a backdoor that communicates using DNS queries rather than a typical HTTPS connection — a channel most networks never inspect closely because every device generates DNS traffic constantly. The backdoor first beacons steadily to check in, then a second, higher-volume burst of DNS queries to the same address follows as it tunnels data out encoded into the queries themselves.',
        },
        population: {
          narrative_identities: [
            { ref: 'victim_identity_1', attributes: { department: 'Marketing', job_title: 'Marketing Coordinator', home_country: 'US' } },
          ],
          narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'MKT-WKS-04', os_platform: 'windows' } }],
          decoy_population_size: { identities: 10, devices: 8 },
          world_time_window_hours: 24,
        },
        kill_chain: [
          {
            step_order: 1,
            mitre_technique_id: 'T1204.002',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'dns_backdoor_execution_v1',
            relative_timestamp: '+4h',
            correlation_group: 'dns-tunnel-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 2,
            mitre_technique_id: 'T1071.004',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'dns_tunnel_c2_beacon_v1',
            relative_timestamp: '+4h10m',
            correlation_group: 'dns-tunnel-1',
            is_required_for_full_credit: true,
          },
          {
            step_order: 3,
            mitre_technique_id: 'T1041',
            entity_ref: 'victim_identity_1',
            device_ref: 'victim_device_1',
            event_template_id: 'dns_tunnel_data_exfil_v1',
            relative_timestamp: '+4h40m',
            correlation_group: 'dns-tunnel-1',
            is_required_for_full_credit: true,
          },
        ],
        noise_profile: {
          signal_to_noise_ratio: 0.08,
          false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }],
        },
        distractor_pool: [],
        scoring_rubric: {
          required_techniques: ['T1204.002', 'T1071.004', 'T1041'],
          required_verdict: 'true_positive',
          min_evidence_items: 3,
          containment_expectations: [],
        },
        hints: [
          { unlock_cost_percent: 5, text: "Check this device's Process Tree for a downloaded tool with an unremarkable name." },
          { unlock_cost_percent: 10, text: 'In the Network tab, look for an unusually large number of connections to the same external address on port 53 — that\'s the DNS port, not a typical C2 port like 443.' },
          { unlock_cost_percent: 15, text: 'Compare the earlier, steadier DNS traffic to a later burst with much higher data sent per query — that shift is when tunneling turns into actual exfiltration.' },
        ],
      },
      threatIntel: [
        {
          indicatorType: 'ip',
          value: '91.219.237.14',
          reputation: 'malicious',
          actorAttribution: 'Unattributed DNS-tunneling C2 infrastructure',
          context: 'Observed as the destination for a sustained, high-volume DNS-port (53) query pattern consistent with DNS tunneling.',
        },
      ],
    },
    systemAuthor.id,
    techniqueBySlug,
  );

  await seedLearningPlatform();

  console.log(
    `Seeded: ${MITRE_TECHNIQUES.length} MITRE techniques, ${DETECTION_RULES.length} detection rules, 21 scenarios, learning platform content.`,
  );
}

// §13.6: one course grouping the existing scenario library into two learning paths by
// theme, rather than inventing placeholder content — every scenario referenced here is a
// real, previously-seeded scenario.
async function seedLearningPlatform(): Promise<void> {
  const scenarios = await prisma.attackScenario.findMany({ select: { id: true, slug: true } });
  const scenarioIdBySlug = new Map(scenarios.map((s) => [s.slug, s.id]));

  const courseDescription =
    'A breadth-first introduction to SOC investigation across identity, email, endpoint, cloud, web, malware, ransomware, and insider-threat scenarios.';
  const course = await prisma.course.upsert({
    where: { slug: 'soc-analyst-fundamentals' },
    update: { description: courseDescription },
    create: {
      slug: 'soc-analyst-fundamentals',
      title: 'SOC Analyst Fundamentals',
      description: courseDescription,
      careerTrack: 'soc_analyst',
    },
  });

  const paths = [
    {
      slug: 'identity-threat-investigation',
      title: 'Identity Threat Investigation',
      passThresholdPercent: 70,
      scenarioSlugs: ['impossible-travel', 'password-spraying-campaign', 'mfa-fatigue-push-bombing', 'legacy-auth-mfa-bypass'],
    },
    {
      slug: 'email-endpoint-insider-threats',
      title: 'Email, Endpoint & Insider Threats',
      passThresholdPercent: 70,
      scenarioSlugs: [
        'phishing-stolen-credentials',
        'bec-wire-transfer-fraud',
        'insider-data-exfiltration',
        'malware-execution-via-attachment',
        'ransomware-lateral-movement-encryption',
        // Added during learning-path expansion: the remaining insider-threat and ransomware
        // scenarios not yet in any path, grouped here since this path already mixes both
        // themes rather than splitting each into its own thin, single-scenario path.
        'insider-bulk-usb-copy-resignation',
        'ransomware-double-extortion-data-theft',
      ],
    },
    {
      slug: 'cloud-web-application-security',
      title: 'Cloud & Web Application Security',
      passThresholdPercent: 70,
      scenarioSlugs: [
        'cloud-account-takeover-access-key',
        'cloud-storage-bucket-public-exposure',
        'oauth-illicit-consent-grant-phishing',
        'web-shell-public-facing-server',
        'web-sql-injection-data-exfiltration',
      ],
    },
    {
      slug: 'advanced-endpoint-malware-analysis',
      title: 'Advanced Endpoint & Malware Analysis',
      passThresholdPercent: 70,
      scenarioSlugs: [
        'credential-dumping-lsass-comsvcs',
        'kerberoasting-service-account-pivot',
        'fileless-malware-startup-persistence',
        'malware-trojan-installer-scheduled-task',
        'dns-tunneling-data-exfiltration',
      ],
    },
  ];

  for (const pathSeed of paths) {
    const path = await prisma.learningPath.upsert({
      where: { slug: pathSeed.slug },
      update: {},
      create: {
        slug: pathSeed.slug,
        courseId: course.id,
        title: pathSeed.title,
        passThresholdPercent: pathSeed.passThresholdPercent,
      },
    });

    for (const [index, scenarioSlug] of pathSeed.scenarioSlugs.entries()) {
      const scenarioId = scenarioIdBySlug.get(scenarioSlug);
      if (!scenarioId) throw new Error(`seedLearningPlatform: unknown scenario slug "${scenarioSlug}"`);
      await prisma.learningPathScenario.upsert({
        where: { learningPathId_scenarioId: { learningPathId: path.id, scenarioId } },
        update: { sortOrder: index },
        create: { learningPathId: path.id, scenarioId, sortOrder: index },
      });
    }

    console.log(`  learning path "${path.slug}" (${pathSeed.scenarioSlugs.length} scenarios)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
