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

function buildMfaFatigueDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Engineering', job_title: 'Software Engineer', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 8, devices: 0 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — MFA fatigue scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1621', randomUUID()],
    ['T1078', randomUUID()],
  ]);

  it('produces 6-9 mfa_denied attempts for the victim from one IP, then one success from the same IP', () => {
    const def = buildMfaFatigueDefinition();
    const result = generateTelemetry(randomUUID(), 7n, def, techniqueIdBySlug);
    const groundTruth = result.signInEvents.filter((s) => s.isGroundTruthEvidence);

    const denials = groundTruth.filter((s) => s.result === 'mfa_denied');
    const successes = groundTruth.filter((s) => s.result === 'success');
    expect(denials.length).toBeGreaterThanOrEqual(6);
    expect(denials.length).toBeLessThanOrEqual(9);
    expect(successes).toHaveLength(1);
    expect(new Set(groundTruth.map((s) => s.sourceIp)).size).toBe(1);
  });

  it('feeds the Alert Engine\'s MFA-fatigue rule correctly end-to-end', async () => {
    const { evaluateMfaFatigueRule } = await import('../alert-engine/rules');
    const def = buildMfaFatigueDefinition();
    const result = generateTelemetry(randomUUID(), 7n, def, techniqueIdBySlug);

    const candidates = evaluateMfaFatigueRule(
      result.signInEvents as unknown as Parameters<typeof evaluateMfaFatigueRule>[0],
      result.identities as unknown as Parameters<typeof evaluateMfaFatigueRule>[1],
    );
    expect(candidates).toHaveLength(1);
  });
});

function buildImpossibleTravelDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Legal', job_title: 'Compliance Analyst', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 8, devices: 0 },
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
    noise_profile: { false_positive_bait: [{ event_template_id: 'legitimate_travel_signin_v1', count: 1 }] },
  };
}

describe('generateTelemetry — impossible travel scenario (§7.2, §8.2, §9.6)', () => {
  const techniqueIdBySlug = new Map([['T1078', randomUUID()]]);

  it('produces two ground-truth sign-ins from different cities close together in time', () => {
    const def = buildImpossibleTravelDefinition();
    const result = generateTelemetry(randomUUID(), 13n, def, techniqueIdBySlug);
    const groundTruth = result.signInEvents.filter((s) => s.isGroundTruthEvidence);

    expect(groundTruth).toHaveLength(2);
    expect(groundTruth[0].sourceCity).not.toBe(groundTruth[1].sourceCity);
    const minutesApart = Math.abs(new Date(groundTruth[1].occurredAt).getTime() - new Date(groundTruth[0].occurredAt).getTime()) / 60000;
    expect(minutesApart).toBeLessThanOrEqual(60);
  });

  it('feeds the Alert Engine\'s impossible-travel rule correctly end-to-end', async () => {
    const { evaluateImpossibleTravelRule } = await import('../alert-engine/rules');
    const def = buildImpossibleTravelDefinition();
    const result = generateTelemetry(randomUUID(), 13n, def, techniqueIdBySlug);

    const candidates = evaluateImpossibleTravelRule(
      result.signInEvents as unknown as Parameters<typeof evaluateImpossibleTravelRule>[0],
      result.identities as unknown as Parameters<typeof evaluateImpossibleTravelRule>[1],
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });
});

function buildInsiderExfilDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Sales', job_title: 'Account Executive', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 8, devices: 0 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — insider data exfiltration scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([['T1048', randomUUID()]]);

  it('produces one outbound ground-truth email with an attachment, authenticated cleanly (no spoofing)', () => {
    const def = buildInsiderExfilDefinition();
    const result = generateTelemetry(randomUUID(), 3n, def, techniqueIdBySlug);
    const groundTruthEmails = result.emailMessages.filter((m) => m.isGroundTruthEvidence);

    expect(groundTruthEmails).toHaveLength(1);
    expect(groundTruthEmails[0].direction).toBe('outbound');
    expect(groundTruthEmails[0].spfResult).toBe('pass');
    expect(groundTruthEmails[0].dkimResult).toBe('pass');
    expect(groundTruthEmails[0].dmarcResult).toBe('pass');
    expect(result.emailAttachments.filter((a) => a.emailMessageId === groundTruthEmails[0].id)).toHaveLength(1);
  });

  it('sends to a personal webmail address derived from the victim, not an organizational one', () => {
    const def = buildInsiderExfilDefinition();
    const result = generateTelemetry(randomUUID(), 3n, def, techniqueIdBySlug);
    const groundTruthEmail = result.emailMessages.find((m) => m.isGroundTruthEvidence)!;

    expect(groundTruthEmail.recipientAddresses[0]).toContain('@gmail.com');
  });

  it('feeds the Alert Engine\'s outbound-personal-email rule correctly end-to-end', async () => {
    const { evaluateOutboundPersonalEmailRule } = await import('../alert-engine/rules');
    const def = buildInsiderExfilDefinition();
    const result = generateTelemetry(randomUUID(), 3n, def, techniqueIdBySlug);

    const candidates = evaluateOutboundPersonalEmailRule(
      result.emailMessages as unknown as Parameters<typeof evaluateOutboundPersonalEmailRule>[0],
      result.emailAttachments as unknown as Parameters<typeof evaluateOutboundPersonalEmailRule>[1],
    );
    expect(candidates).toHaveLength(1);
  });
});

function buildRansomwareDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'compromised_admin', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
      ],
      narrative_devices: [
        { ref: 'patient_zero_device', attributes: { hostname: 'IT-WKS-04', os_platform: 'windows' } },
        { ref: 'file_server_device', attributes: { hostname: 'FS-PROD-01', os_platform: 'windows' } },
      ],
      decoy_population_size: { identities: 3, devices: 3 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — ransomware lateral-movement scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1021.002', randomUUID()],
    ['T1486', randomUUID()],
  ]);

  it('places the source connection on the first device and the remote execution + encryption on the second', () => {
    const def = buildRansomwareDefinition();
    const result = generateTelemetry(randomUUID(), 11n, def, techniqueIdBySlug);
    const patientZero = result.devices.find((d) => d.hostname === 'IT-WKS-04')!;
    const fileServer = result.devices.find((d) => d.hostname === 'FS-PROD-01')!;

    expect(result.networkEvents.filter((n) => n.deviceId === patientZero.id)).toHaveLength(1);
    expect(result.processEvents.filter((p) => p.deviceId === fileServer.id)).toHaveLength(3);
    expect(result.fileEvents.filter((f) => f.deviceId === fileServer.id && f.action === 'encrypted').length).toBeGreaterThanOrEqual(5);
  });

  it('shares one correlationId across the network hop, the remote execution, and the encryption burst', () => {
    const def = buildRansomwareDefinition();
    const result = generateTelemetry(randomUUID(), 11n, def, techniqueIdBySlug);
    const networkEvent = result.networkEvents.find((n) => n.isGroundTruthEvidence)!;
    const processEvent = result.processEvents.find((p) => p.isGroundTruthEvidence)!;
    const fileEvent = result.fileEvents.find((f) => f.isGroundTruthEvidence)!;

    expect(networkEvent.correlationId).toBeTruthy();
    expect(networkEvent.correlationId).toEqual(processEvent.correlationId);
    expect(networkEvent.correlationId).toEqual(fileEvent.correlationId);
  });

  it("feeds the Alert Engine's lateral-movement and mass-encryption rules correctly end-to-end", async () => {
    const { evaluateLateralMovementRule, evaluateMassEncryptionRule } = await import('../alert-engine/rules');
    const def = buildRansomwareDefinition();
    const result = generateTelemetry(randomUUID(), 11n, def, techniqueIdBySlug);

    const lateralMovementCandidates = evaluateLateralMovementRule(
      result.processEvents as unknown as Parameters<typeof evaluateLateralMovementRule>[0],
      result.devices as unknown as Parameters<typeof evaluateLateralMovementRule>[1],
    );
    const massEncryptionCandidates = evaluateMassEncryptionRule(
      result.fileEvents as unknown as Parameters<typeof evaluateMassEncryptionRule>[0],
      result.devices as unknown as Parameters<typeof evaluateMassEncryptionRule>[1],
    );

    expect(lateralMovementCandidates).toHaveLength(1);
    expect(massEncryptionCandidates).toHaveLength(1);
  });
});

function buildLegacyAuthDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'Finance', job_title: 'Financial Analyst', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 4, devices: 0 },
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
    noise_profile: { false_positive_bait: [{ event_template_id: 'legacy_auth_benign_service_v1', count: 3 }] },
  };
}

describe('generateTelemetry — legacy auth MFA bypass scenario (§7.2, §8.2, §9)', () => {
  const techniqueIdBySlug = new Map([
    ['T1078', randomUUID()],
    ['T1114.002', randomUUID()],
  ]);

  it('marks the victim identity as MFA-enforced and produces a legacy successful bypass plus a mailbox-collection burst', () => {
    const def = buildLegacyAuthDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);
    const victim = result.identities.find((i) => i.isGroundTruthActor)!;

    const groundTruthSignIns = result.signInEvents.filter((s) => s.isGroundTruthEvidence);
    expect(groundTruthSignIns.length).toBeGreaterThanOrEqual(5);
    expect(groundTruthSignIns.every((s) => s.identityId === victim.id && s.isLegacyAuth && s.result === 'success')).toBe(true);
  });

  it("feeds the Alert Engine's legacy-auth-bypass rule correctly end-to-end", async () => {
    const { evaluateLegacyAuthBypassRule } = await import('../alert-engine/rules');
    const def = buildLegacyAuthDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);

    const candidates = evaluateLegacyAuthBypassRule(
      result.signInEvents as unknown as Parameters<typeof evaluateLegacyAuthBypassRule>[0],
      result.identities as unknown as Parameters<typeof evaluateLegacyAuthBypassRule>[1],
    );

    const victim = result.identities.find((i) => i.isGroundTruthActor)!;
    const victimCandidate = candidates.find((c) => c.primaryEntityId === victim.id);
    expect(victimCandidate).toBeDefined();
    expect(victimCandidate!.evidenceRefs.length).toBeGreaterThanOrEqual(5);
  });
});

function buildCloudTakeoverDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Cloud Platform Engineer', home_country: 'US' } },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 6, devices: 0 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — cloud account takeover scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1098.001', randomUUID()],
    ['T1530', randomUUID()],
  ]);

  it('produces one CreateAccessKey event and a burst of bucket enumeration events for the victim identity', () => {
    const def = buildCloudTakeoverDefinition();
    const result = generateTelemetry(randomUUID(), 17n, def, techniqueIdBySlug);
    const victim = result.identities.find((i) => i.isGroundTruthActor)!;
    const groundTruth = result.cloudEvents.filter((c) => c.isGroundTruthEvidence);

    const keyCreation = groundTruth.filter((c) => c.actionName === 'CreateAccessKey');
    const enumeration = groundTruth.filter((c) => c.actionName !== 'CreateAccessKey');
    expect(keyCreation).toHaveLength(1);
    expect(enumeration.length).toBeGreaterThanOrEqual(6);
    expect(groundTruth.every((c) => c.identityId === victim.id)).toBe(true);
  });

  it('shares one correlationId and one attacker IP across the key creation and the enumeration burst', () => {
    const def = buildCloudTakeoverDefinition();
    const result = generateTelemetry(randomUUID(), 17n, def, techniqueIdBySlug);
    const groundTruth = result.cloudEvents.filter((c) => c.isGroundTruthEvidence);

    expect(new Set(groundTruth.map((c) => c.correlationId)).size).toBe(1);
    expect(new Set(groundTruth.map((c) => c.sourceIp)).size).toBe(1);
  });

  it("feeds the Alert Engine's suspicious-cloud-action rule correctly end-to-end", async () => {
    const { evaluateSuspiciousCloudActionRule } = await import('../alert-engine/rules');
    const def = buildCloudTakeoverDefinition();
    const result = generateTelemetry(randomUUID(), 17n, def, techniqueIdBySlug);

    const candidates = evaluateSuspiciousCloudActionRule(
      result.cloudEvents as unknown as Parameters<typeof evaluateSuspiciousCloudActionRule>[0],
      result.identities as unknown as Parameters<typeof evaluateSuspiciousCloudActionRule>[1],
    );

    // only CreateAccessKey is a "sensitive" action — bucket enumeration (ListBucket/GetObject) is a
    // real gap in this rule's coverage, deliberately left for the student to find via evidence review.
    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toContain('CreateAccessKey');
  });
});

function buildWebShellDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'web_server_service_account', attributes: { department: 'IT', job_title: 'Service Account', home_country: 'US' } },
      ],
      narrative_devices: [{ ref: 'web_server_device', attributes: { hostname: 'WEB-PROD-01', os_platform: 'linux' } }],
      decoy_population_size: { identities: 4, devices: 4 },
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
      false_positive_bait: [{ event_template_id: 'web_legitimate_monitoring_v1', count: 4, device_ref: 'web_server_device' }],
    },
  };
}

describe('generateTelemetry — web shell scenario (§7.2, §8.2, §10.3)', () => {
  const techniqueIdBySlug = new Map([['T1505.003', randomUUID()]]);

  it('produces one initial-access GET and a burst of POST commands, all on the web server device', () => {
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);
    const webServer = result.devices.find((d) => d.hostname === 'WEB-PROD-01')!;
    const groundTruth = result.httpRequests.filter((h) => h.isGroundTruthEvidence);

    expect(groundTruth.every((h) => h.deviceId === webServer.id)).toBe(true);
    expect(groundTruth.filter((h) => h.method === 'GET')).toHaveLength(1);
    expect(groundTruth.filter((h) => h.method === 'POST').length).toBeGreaterThanOrEqual(5);
    expect(new Set(groundTruth.map((h) => h.url)).size).toBe(1);
  });

  it('generates the configured false-positive monitoring bait on the same device, unmarked as ground truth', () => {
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);
    const webServer = result.devices.find((d) => d.hostname === 'WEB-PROD-01')!;

    const noise = result.httpRequests.filter((h) => !h.isGroundTruthEvidence);
    expect(noise).toHaveLength(4);
    expect(noise.every((h) => h.deviceId === webServer.id && h.url === '/api/health-check.php')).toBe(true);
  });

  it("feeds the Alert Engine's web-shell-access rule, firing on both the attack and the ambiguous monitoring bait (§8.6)", async () => {
    const { evaluateWebShellAccessRule } = await import('../alert-engine/rules');
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);

    const candidates = evaluateWebShellAccessRule(
      result.httpRequests as unknown as Parameters<typeof evaluateWebShellAccessRule>[0],
      result.devices as unknown as Parameters<typeof evaluateWebShellAccessRule>[1],
    );

    expect(candidates).toHaveLength(2);
    const webshellCandidate = candidates.find((c) => c.title.includes('x7f2a9c.php'));
    const monitoringCandidate = candidates.find((c) => c.title.includes('health-check.php'));
    expect(webshellCandidate).toBeDefined();
    expect(monitoringCandidate).toBeDefined();
    expect(webshellCandidate!.evidenceRefs.length).toBeGreaterThanOrEqual(6);
  });
});

function buildFilelessMalwareDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        { ref: 'victim_identity_1', attributes: { department: 'IT', job_title: 'Systems Administrator', home_country: 'US' } },
      ],
      narrative_devices: [{ ref: 'victim_device_1', attributes: { hostname: 'IT-WKS-11', os_platform: 'windows' } }],
      decoy_population_size: { identities: 6, devices: 6 },
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
      false_positive_bait: [{ event_template_id: 'legitimate_startup_shortcut_v1', count: 2, device_ref: 'victim_device_1' }],
    },
  };
}

describe('generateTelemetry — fileless malware scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1059.001', randomUUID()],
    ['T1547.001', randomUUID()],
    ['T1071.001', randomUUID()],
  ]);

  it('produces one PowerShell process, one persistence file event, and a C2 beacon burst, all on the victim device', () => {
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);
    const victimDevice = result.devices.find((d) => d.hostname === 'IT-WKS-11')!;

    const groundTruthProcesses = result.processEvents.filter((p) => p.isGroundTruthEvidence);
    const groundTruthFiles = result.fileEvents.filter((f) => f.isGroundTruthEvidence);
    const groundTruthNetwork = result.networkEvents.filter((n) => n.isGroundTruthEvidence);

    expect(groundTruthProcesses).toHaveLength(1);
    expect(groundTruthProcesses[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthProcesses[0].imagePath.toLowerCase()).toContain('powershell.exe');

    expect(groundTruthFiles).toHaveLength(1);
    expect(groundTruthFiles[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthFiles[0].filePath).toContain('\\Start Menu\\Programs\\Startup\\');

    expect(groundTruthNetwork.length).toBeGreaterThanOrEqual(4);
    expect(groundTruthNetwork.every((n) => n.deviceId === victimDevice.id)).toBe(true);
  });

  it('threads the same processGuid through the PowerShell process and the C2 beacon (correlatable in the Device Portal)', () => {
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);
    const process = result.processEvents.find((p) => p.isGroundTruthEvidence)!;
    const beacons = result.networkEvents.filter((n) => n.isGroundTruthEvidence);

    expect(beacons.every((b) => b.processGuid === process.processGuid)).toBe(true);
  });

  it('generates the configured false-positive Startup-shortcut bait on the same device, unmarked as ground truth', () => {
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);
    const victimDevice = result.devices.find((d) => d.hostname === 'IT-WKS-11')!;

    const noise = result.fileEvents.filter((f) => !f.isGroundTruthEvidence);
    expect(noise).toHaveLength(2);
    expect(noise.every((f) => f.deviceId === victimDevice.id && f.filePath.includes('\\Start Menu\\Programs\\Startup\\'))).toBe(true);
  });

  it("feeds the Alert Engine's persistence-artifact rule, firing on both the real backdoor and the benign bait (§8.6)", async () => {
    const { evaluatePersistenceArtifactRule } = await import('../alert-engine/rules');
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);

    const candidates = evaluatePersistenceArtifactRule(
      result.fileEvents as unknown as Parameters<typeof evaluatePersistenceArtifactRule>[0],
      result.devices as unknown as Parameters<typeof evaluatePersistenceArtifactRule>[1],
    );

    expect(candidates).toHaveLength(3);
    const realCandidate = candidates.find((c) => c.title.includes('WinSvcHelper.lnk'));
    const baitCandidates = candidates.filter((c) => c.title.includes('OneDrive.lnk'));
    expect(realCandidate).toBeDefined();
    expect(baitCandidates).toHaveLength(2);
  });
});
