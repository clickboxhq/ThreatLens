import { randomUUID } from 'crypto';
import { generateTelemetry, GroundTruthDefinition } from './generator';

function buildDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Finance', job_title: 'Accounts Payable Specialist', home_country: 'US' } },
      ],
      narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'FIN-WKS-07', os_platform: 'windows' } }],
      decoy_population_size: { identities: 5, devices: 4 },
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
      false_positive_bait: [
        { event_template_id: 'legitimate_travel_signin_v1', count: 1 },
        { event_template_id: 'benign_it_admin_email_v1', count: 2 },
      ],
    },
  };
}

describe('generateTelemetry (§7.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1566.002', randomUUID()],
    ['T1078', randomUUID()],
  ]);

  it('is deterministic for a given seed (reproducibility, §6.9)', () => {
    const sessionId = randomUUID();
    const seed = 123456789n;
    const def = buildDefinition();

    const first = generateTelemetry(sessionId, seed, def, techniqueIdBySlug);
    const second = generateTelemetry(sessionId, seed, def, techniqueIdBySlug);

    expect(first.identities.map((i) => i.displayName)).toEqual(second.identities.map((i) => i.displayName));
    expect(first.signInEvents.map((e) => e.sourceCountry)).toEqual(second.signInEvents.map((e) => e.sourceCountry));
  });

  it('produces the narrative identity plus the full decoy population', () => {
    const def = buildDefinition();
    const result = generateTelemetry(randomUUID(), 1n, def, techniqueIdBySlug);
    expect(result.identities).toHaveLength(1 + 5);
    expect(result.devices).toHaveLength(1 + 4);
  });

  it('stitches a shared correlationId across events in the same correlation_group (§7.2 stage 4)', () => {
    const def = buildDefinition();
    const result = generateTelemetry(randomUUID(), 42n, def, techniqueIdBySlug);

    const phishingEmail = result.emailMessages.find((m) => m.isGroundTruthEvidence);
    const riskySignIn = result.signInEvents.find((s) => s.isGroundTruthEvidence);

    expect(phishingEmail).toBeDefined();
    expect(riskySignIn).toBeDefined();
    expect(phishingEmail!.correlationId).toBeTruthy();
    expect(phishingEmail!.correlationId).toEqual(riskySignIn!.correlationId);
  });

  it('marks ground-truth events with the correct MITRE technique and leaves noise events unmarked', () => {
    const def = buildDefinition();
    const techniqueIdBySlugLocal = techniqueIdBySlug;
    const result = generateTelemetry(randomUUID(), 7n, def, techniqueIdBySlugLocal);

    const phishingEmail = result.emailMessages.find((m) => m.isGroundTruthEvidence)!;
    expect(phishingEmail.mitreTechniqueId).toEqual(techniqueIdBySlugLocal.get('T1566.002'));

    const noiseEmails = result.emailMessages.filter((m) => !m.isGroundTruthEvidence);
    expect(noiseEmails).toHaveLength(2);
    for (const email of noiseEmails) {
      expect(email.mitreTechniqueId ?? null).toBeNull();
    }
  });

  it('generates the configured count of false-positive bait events', () => {
    const def = buildDefinition();
    const result = generateTelemetry(randomUUID(), 99n, def, techniqueIdBySlug);

    const noiseSignIns = result.signInEvents.filter((s) => !s.isGroundTruthEvidence && (s.raw as { pattern?: string })?.pattern === 'legitimate_travel_signin');
    expect(noiseSignIns).toHaveLength(1);

    const noiseEmails = result.emailMessages.filter((m) => !m.isGroundTruthEvidence);
    expect(noiseEmails).toHaveLength(2);
  });
});

function buildPasswordSprayDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Sales', job_title: 'Account Executive', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 15, devices: 0 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — password spray scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1110.003', randomUUID()],
    ['T1078', randomUUID()],
  ]);

  it('produces a batch of failed attempts across the victim plus several decoys, and one success', () => {
    const def = buildPasswordSprayDefinition();
    const result = generateTelemetry(randomUUID(), 55n, def, techniqueIdBySlug);

    const groundTruthSignIns = result.signInEvents.filter((s) => s.isGroundTruthEvidence);
    const failed = groundTruthSignIns.filter((s) => s.result === 'failure');
    const succeeded = groundTruthSignIns.filter((s) => s.result === 'success');

    // victim + 7 decoys targeted, 1-2 attempts each => at least 8 failed attempts
    const distinctFailedIdentities = new Set(failed.map((s) => s.identityId));
    expect(distinctFailedIdentities.size).toBeGreaterThanOrEqual(8);
    expect(succeeded).toHaveLength(1);
  });

  it('uses the same attacker IP for every failed attempt and the eventual success (correlatable by an investigator)', () => {
    const def = buildPasswordSprayDefinition();
    const result = generateTelemetry(randomUUID(), 55n, def, techniqueIdBySlug);
    const groundTruthSignIns = result.signInEvents.filter((s) => s.isGroundTruthEvidence);

    const distinctIps = new Set(groundTruthSignIns.map((s) => s.sourceIp));
    expect(distinctIps.size).toBe(1);
  });

  it('feeds the Alert Engine\'s password-spray rule correctly end-to-end', async () => {
    const { evaluatePasswordSprayRule } = await import('../alert-engine/rules');
    const def = buildPasswordSprayDefinition();
    const result = generateTelemetry(randomUUID(), 55n, def, techniqueIdBySlug);

    const candidates = evaluatePasswordSprayRule(
      result.signInEvents as unknown as Parameters<typeof evaluatePasswordSprayRule>[0],
      result.identities as unknown as Parameters<typeof evaluatePasswordSprayRule>[1],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs.length).toBeGreaterThanOrEqual(9);
  });
});

function buildBecDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Finance', job_title: 'Controller', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 10, devices: 0 },
      world_time_window_hours: 24,
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
    noise_profile: { false_positive_bait: [{ event_template_id: 'benign_it_admin_email_v1', count: 1 }] },
  };
}

describe('generateTelemetry — BEC wire transfer scenario (§7.2)', () => {
  const techniqueIdBySlug = new Map([['T1656', randomUUID()]]);

  it('produces two correlated ground-truth emails with no attachments or URLs (pure social engineering)', () => {
    const def = buildBecDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);

    const groundTruthEmails = result.emailMessages.filter((m) => m.isGroundTruthEvidence);
    expect(groundTruthEmails).toHaveLength(2);
    expect(new Set(groundTruthEmails.map((m) => m.correlationId)).size).toBe(1);
    expect(result.emailUrls).toHaveLength(0);
    expect(result.emailAttachments).toHaveLength(0);
  });

  it('marks both emails with the T1656 technique, distinct from the noise email', () => {
    const def = buildBecDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);
    const t1656Id = techniqueIdBySlug.get('T1656');

    const groundTruthEmails = result.emailMessages.filter((m) => m.isGroundTruthEvidence);
    expect(groundTruthEmails.every((m) => m.mitreTechniqueId === t1656Id)).toBe(true);

    const noiseEmails = result.emailMessages.filter((m) => !m.isGroundTruthEvidence);
    expect(noiseEmails).toHaveLength(1);
    expect(noiseEmails[0].mitreTechniqueId ?? null).toBeNull();
  });
});
