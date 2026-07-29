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
