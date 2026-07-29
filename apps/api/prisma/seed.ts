// Reference data + the one walking-skeleton scenario (docs/SOCVerse-Architecture.md §12.1, §12.6).
// Idempotent: safe to re-run against the same database.

import { PrismaClient } from '@prisma/client';

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
    techniqueId: 'T1621',
    name: 'Multi-Factor Authentication Request Generation',
    tactic: 'TA0006',
    description: 'Adversaries repeatedly generate MFA push notifications to induce a user into approving one, bypassing MFA.',
    url: 'https://attack.mitre.org/techniques/T1621/',
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
];

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

  const groundTruthDefinition = {
    metadata: {
      category: 'email',
      difficulty: 'beginner',
      estimated_minutes: 30,
      narrative_summary:
        "A finance-department employee clicks a spearphishing link, enters their credentials on a lookalike login page, and the attacker uses the stolen credentials to sign in from an unfamiliar location shortly after.",
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
  };

  const scenario = await prisma.attackScenario.upsert({
    where: { slug: 'phishing-stolen-credentials' },
    update: {},
    create: {
      slug: 'phishing-stolen-credentials',
      title: 'Phishing → Stolen Credentials → Risky Sign-in',
      summary:
        'A finance employee received a suspicious email. Shortly after, their account signed in from an unusual location. Investigate the mailbox and identity to determine what happened.',
      category: 'email',
      difficulty: 'beginner',
      estimatedMinutes: 30,
      status: 'published',
      authorId: systemAuthor.id,
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
        groundTruthDefinition,
        publishedAt: new Date(),
        createdBy: systemAuthor.id,
      },
    });
  }

  await prisma.attackScenario.update({
    where: { id: scenario.id },
    data: { currentVersionId: version.id },
  });

  for (const techniqueSlug of ['T1566.002', 'T1078']) {
    const mitreTechniqueId = techniqueBySlug.get(techniqueSlug)!;
    await prisma.scenarioTechnique.upsert({
      where: {
        scenarioVersionId_mitreTechniqueId: {
          scenarioVersionId: version.id,
          mitreTechniqueId,
        },
      },
      update: {},
      create: {
        scenarioVersionId: version.id,
        mitreTechniqueId,
        isRequiredForFullCredit: true,
      },
    });
  }

  const existingIndicators = await prisma.threatIntelIndicator.count({
    where: { scenarioVersionId: version.id },
  });
  if (existingIndicators === 0) {
    await prisma.threatIntelIndicator.createMany({
      data: [
        {
          scenarioVersionId: version.id,
          indicatorType: 'domain',
          value: 'secure-invoice-portal-verify.com',
          reputation: 'malicious',
          actorAttribution: 'Unattributed phishing kit',
          context: 'Lookalike domain hosting a credential-harvesting login page impersonating an invoicing portal.',
        },
        {
          scenarioVersionId: version.id,
          indicatorType: 'domain',
          value: 'contoso-finance.example.com',
          reputation: 'known_good',
          context: "The organization's legitimate finance portal domain, for comparison.",
        },
      ],
    });
  }

  console.log(`Seeded: ${MITRE_TECHNIQUES.length} MITRE techniques, ${DETECTION_RULES.length} detection rules, scenario "${scenario.slug}" v${version.versionNumber}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
