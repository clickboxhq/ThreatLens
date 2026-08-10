import { randomUUID } from 'crypto';
import { generateTelemetry, GroundTruthDefinition } from './generator';

function buildDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Finance',
            job_title: 'Accounts Payable Specialist',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'FIN-WKS-07', os_platform: 'windows' },
        },
      ],
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

    expect(first.identities.map((i) => i.displayName)).toEqual(
      second.identities.map((i) => i.displayName),
    );
    expect(first.signInEvents.map((e) => e.sourceCountry)).toEqual(
      second.signInEvents.map((e) => e.sourceCountry),
    );
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

    const phishingEmail = result.emailMessages.find(
      (m) => m.isGroundTruthEvidence,
    );
    const riskySignIn = result.signInEvents.find(
      (s) => s.isGroundTruthEvidence,
    );

    expect(phishingEmail).toBeDefined();
    expect(riskySignIn).toBeDefined();
    expect(phishingEmail!.correlationId).toBeTruthy();
    expect(phishingEmail!.correlationId).toEqual(riskySignIn!.correlationId);
  });

  it('marks ground-truth events with the correct MITRE technique and leaves noise events unmarked', () => {
    const def = buildDefinition();
    const techniqueIdBySlugLocal = techniqueIdBySlug;
    const result = generateTelemetry(
      randomUUID(),
      7n,
      def,
      techniqueIdBySlugLocal,
    );

    const phishingEmail = result.emailMessages.find(
      (m) => m.isGroundTruthEvidence,
    )!;
    expect(phishingEmail.mitreTechniqueId).toEqual(
      techniqueIdBySlugLocal.get('T1566.002'),
    );

    const noiseEmails = result.emailMessages.filter(
      (m) => !m.isGroundTruthEvidence,
    );
    expect(noiseEmails).toHaveLength(2);
    for (const email of noiseEmails) {
      expect(email.mitreTechniqueId ?? null).toBeNull();
    }
  });

  it('generates the configured count of false-positive bait events', () => {
    const def = buildDefinition();
    const result = generateTelemetry(randomUUID(), 99n, def, techniqueIdBySlug);

    const noiseSignIns = result.signInEvents.filter(
      (s) =>
        !s.isGroundTruthEvidence &&
        (s.raw as { pattern?: string })?.pattern === 'legitimate_travel_signin',
    );
    expect(noiseSignIns).toHaveLength(1);

    const noiseEmails = result.emailMessages.filter(
      (m) => !m.isGroundTruthEvidence,
    );
    expect(noiseEmails).toHaveLength(2);
  });
});

function buildPasswordSprayDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Sales',
            job_title: 'Account Executive',
            home_country: 'US',
          },
        },
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

    const groundTruthSignIns = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );
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
    const groundTruthSignIns = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );

    const distinctIps = new Set(groundTruthSignIns.map((s) => s.sourceIp));
    expect(distinctIps.size).toBe(1);
  });

  it("feeds the Alert Engine's password-spray rule correctly end-to-end", async () => {
    const { evaluatePasswordSprayRule } = await import('../alert-engine/rules');
    const def = buildPasswordSprayDefinition();
    const result = generateTelemetry(randomUUID(), 55n, def, techniqueIdBySlug);

    const candidates = evaluatePasswordSprayRule(
      result.signInEvents as unknown as Parameters<
        typeof evaluatePasswordSprayRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluatePasswordSprayRule
      >[1],
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
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Finance',
            job_title: 'Controller',
            home_country: 'US',
          },
        },
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
    noise_profile: {
      false_positive_bait: [
        { event_template_id: 'benign_it_admin_email_v1', count: 1 },
      ],
    },
  };
}

describe('generateTelemetry — BEC wire transfer scenario (§7.2)', () => {
  const techniqueIdBySlug = new Map([['T1656', randomUUID()]]);

  it('produces two correlated ground-truth emails with no attachments or URLs (pure social engineering)', () => {
    const def = buildBecDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);

    const groundTruthEmails = result.emailMessages.filter(
      (m) => m.isGroundTruthEvidence,
    );
    expect(groundTruthEmails).toHaveLength(2);
    expect(new Set(groundTruthEmails.map((m) => m.correlationId)).size).toBe(1);
    expect(result.emailUrls).toHaveLength(0);
    expect(result.emailAttachments).toHaveLength(0);
  });

  it('marks both emails with the T1656 technique, distinct from the noise email', () => {
    const def = buildBecDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);
    const t1656Id = techniqueIdBySlug.get('T1656');

    const groundTruthEmails = result.emailMessages.filter(
      (m) => m.isGroundTruthEvidence,
    );
    expect(groundTruthEmails.every((m) => m.mitreTechniqueId === t1656Id)).toBe(
      true,
    );

    const noiseEmails = result.emailMessages.filter(
      (m) => !m.isGroundTruthEvidence,
    );
    expect(noiseEmails).toHaveLength(1);
    expect(noiseEmails[0].mitreTechniqueId ?? null).toBeNull();
  });
});

function buildMfaFatigueDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Engineering',
            job_title: 'Software Engineer',
            home_country: 'US',
          },
        },
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
    const groundTruth = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );

    const denials = groundTruth.filter((s) => s.result === 'mfa_denied');
    const successes = groundTruth.filter((s) => s.result === 'success');
    expect(denials.length).toBeGreaterThanOrEqual(6);
    expect(denials.length).toBeLessThanOrEqual(9);
    expect(successes).toHaveLength(1);
    expect(new Set(groundTruth.map((s) => s.sourceIp)).size).toBe(1);
  });

  it("feeds the Alert Engine's MFA-fatigue rule correctly end-to-end", async () => {
    const { evaluateMfaFatigueRule } = await import('../alert-engine/rules');
    const def = buildMfaFatigueDefinition();
    const result = generateTelemetry(randomUUID(), 7n, def, techniqueIdBySlug);

    const candidates = evaluateMfaFatigueRule(
      result.signInEvents as unknown as Parameters<
        typeof evaluateMfaFatigueRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateMfaFatigueRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
  });
});

function buildImpossibleTravelDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Legal',
            job_title: 'Compliance Analyst',
            home_country: 'US',
          },
        },
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
    noise_profile: {
      false_positive_bait: [
        { event_template_id: 'legitimate_travel_signin_v1', count: 1 },
      ],
    },
  };
}

describe('generateTelemetry — impossible travel scenario (§7.2, §8.2, §9.6)', () => {
  const techniqueIdBySlug = new Map([['T1078', randomUUID()]]);

  it('produces two ground-truth sign-ins from different cities close together in time', () => {
    const def = buildImpossibleTravelDefinition();
    const result = generateTelemetry(randomUUID(), 13n, def, techniqueIdBySlug);
    const groundTruth = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );

    expect(groundTruth).toHaveLength(2);
    expect(groundTruth[0].sourceCity).not.toBe(groundTruth[1].sourceCity);
    const minutesApart =
      Math.abs(
        new Date(groundTruth[1].occurredAt).getTime() -
          new Date(groundTruth[0].occurredAt).getTime(),
      ) / 60000;
    expect(minutesApart).toBeLessThanOrEqual(60);
  });

  it("feeds the Alert Engine's impossible-travel rule correctly end-to-end", async () => {
    const { evaluateImpossibleTravelRule } =
      await import('../alert-engine/rules');
    const def = buildImpossibleTravelDefinition();
    const result = generateTelemetry(randomUUID(), 13n, def, techniqueIdBySlug);

    const candidates = evaluateImpossibleTravelRule(
      result.signInEvents as unknown as Parameters<
        typeof evaluateImpossibleTravelRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateImpossibleTravelRule
      >[1],
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });
});

function buildInsiderExfilDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Sales',
            job_title: 'Account Executive',
            home_country: 'US',
          },
        },
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
    const groundTruthEmails = result.emailMessages.filter(
      (m) => m.isGroundTruthEvidence,
    );

    expect(groundTruthEmails).toHaveLength(1);
    expect(groundTruthEmails[0].direction).toBe('outbound');
    expect(groundTruthEmails[0].spfResult).toBe('pass');
    expect(groundTruthEmails[0].dkimResult).toBe('pass');
    expect(groundTruthEmails[0].dmarcResult).toBe('pass');
    expect(
      result.emailAttachments.filter(
        (a) => a.emailMessageId === groundTruthEmails[0].id,
      ),
    ).toHaveLength(1);
  });

  it('sends to a personal webmail address derived from the victim, not an organizational one', () => {
    const def = buildInsiderExfilDefinition();
    const result = generateTelemetry(randomUUID(), 3n, def, techniqueIdBySlug);
    const groundTruthEmail = result.emailMessages.find(
      (m) => m.isGroundTruthEvidence,
    )!;

    expect(groundTruthEmail.recipientAddresses[0]).toContain('@gmail.com');
  });

  it("feeds the Alert Engine's outbound-personal-email rule correctly end-to-end", async () => {
    const { evaluateOutboundPersonalEmailRule } =
      await import('../alert-engine/rules');
    const def = buildInsiderExfilDefinition();
    const result = generateTelemetry(randomUUID(), 3n, def, techniqueIdBySlug);

    const candidates = evaluateOutboundPersonalEmailRule(
      result.emailMessages as unknown as Parameters<
        typeof evaluateOutboundPersonalEmailRule
      >[0],
      result.emailAttachments as unknown as Parameters<
        typeof evaluateOutboundPersonalEmailRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
  });
});

function buildRansomwareDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'compromised_admin',
          attributes: {
            department: 'IT',
            job_title: 'Systems Administrator',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'patient_zero_device',
          attributes: { hostname: 'IT-WKS-04', os_platform: 'windows' },
        },
        {
          ref: 'file_server_device',
          attributes: { hostname: 'FS-PROD-01', os_platform: 'windows' },
        },
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

    expect(
      result.networkEvents.filter((n) => n.deviceId === patientZero.id),
    ).toHaveLength(1);
    expect(
      result.processEvents.filter((p) => p.deviceId === fileServer.id),
    ).toHaveLength(3);
    expect(
      result.fileEvents.filter(
        (f) => f.deviceId === fileServer.id && f.action === 'encrypted',
      ).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it('shares one correlationId across the network hop, the remote execution, and the encryption burst', () => {
    const def = buildRansomwareDefinition();
    const result = generateTelemetry(randomUUID(), 11n, def, techniqueIdBySlug);
    const networkEvent = result.networkEvents.find(
      (n) => n.isGroundTruthEvidence,
    )!;
    const processEvent = result.processEvents.find(
      (p) => p.isGroundTruthEvidence,
    )!;
    const fileEvent = result.fileEvents.find((f) => f.isGroundTruthEvidence)!;

    expect(networkEvent.correlationId).toBeTruthy();
    expect(networkEvent.correlationId).toEqual(processEvent.correlationId);
    expect(networkEvent.correlationId).toEqual(fileEvent.correlationId);
  });

  it("feeds the Alert Engine's lateral-movement and mass-encryption rules correctly end-to-end", async () => {
    const { evaluateLateralMovementRule, evaluateMassEncryptionRule } =
      await import('../alert-engine/rules');
    const def = buildRansomwareDefinition();
    const result = generateTelemetry(randomUUID(), 11n, def, techniqueIdBySlug);

    const lateralMovementCandidates = evaluateLateralMovementRule(
      result.processEvents as unknown as Parameters<
        typeof evaluateLateralMovementRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateLateralMovementRule
      >[1],
    );
    const massEncryptionCandidates = evaluateMassEncryptionRule(
      result.fileEvents as unknown as Parameters<
        typeof evaluateMassEncryptionRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateMassEncryptionRule
      >[1],
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
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Finance',
            job_title: 'Financial Analyst',
            home_country: 'US',
          },
        },
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
    noise_profile: {
      false_positive_bait: [
        { event_template_id: 'legacy_auth_benign_service_v1', count: 3 },
      ],
    },
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

    const groundTruthSignIns = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );
    expect(groundTruthSignIns.length).toBeGreaterThanOrEqual(5);
    expect(
      groundTruthSignIns.every(
        (s) =>
          s.identityId === victim.id &&
          s.isLegacyAuth &&
          s.result === 'success',
      ),
    ).toBe(true);
  });

  it("feeds the Alert Engine's legacy-auth-bypass rule correctly end-to-end", async () => {
    const { evaluateLegacyAuthBypassRule } =
      await import('../alert-engine/rules');
    const def = buildLegacyAuthDefinition();
    const result = generateTelemetry(randomUUID(), 21n, def, techniqueIdBySlug);

    const candidates = evaluateLegacyAuthBypassRule(
      result.signInEvents as unknown as Parameters<
        typeof evaluateLegacyAuthBypassRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateLegacyAuthBypassRule
      >[1],
    );

    const victim = result.identities.find((i) => i.isGroundTruthActor)!;
    const victimCandidate = candidates.find(
      (c) => c.primaryEntityId === victim.id,
    );
    expect(victimCandidate).toBeDefined();
    expect(victimCandidate!.evidenceRefs.length).toBeGreaterThanOrEqual(5);
  });
});

function buildCloudTakeoverDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Cloud Platform Engineer',
            home_country: 'US',
          },
        },
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
    const groundTruth = result.cloudEvents.filter(
      (c) => c.isGroundTruthEvidence,
    );

    const keyCreation = groundTruth.filter(
      (c) => c.actionName === 'CreateAccessKey',
    );
    const enumeration = groundTruth.filter(
      (c) => c.actionName !== 'CreateAccessKey',
    );
    expect(keyCreation).toHaveLength(1);
    expect(enumeration.length).toBeGreaterThanOrEqual(6);
    expect(groundTruth.every((c) => c.identityId === victim.id)).toBe(true);
  });

  it('shares one correlationId and one attacker IP across the key creation and the enumeration burst', () => {
    const def = buildCloudTakeoverDefinition();
    const result = generateTelemetry(randomUUID(), 17n, def, techniqueIdBySlug);
    const groundTruth = result.cloudEvents.filter(
      (c) => c.isGroundTruthEvidence,
    );

    expect(new Set(groundTruth.map((c) => c.correlationId)).size).toBe(1);
    expect(new Set(groundTruth.map((c) => c.sourceIp)).size).toBe(1);
  });

  it("feeds the Alert Engine's suspicious-cloud-action rule correctly end-to-end", async () => {
    const { evaluateSuspiciousCloudActionRule } =
      await import('../alert-engine/rules');
    const def = buildCloudTakeoverDefinition();
    const result = generateTelemetry(randomUUID(), 17n, def, techniqueIdBySlug);

    const candidates = evaluateSuspiciousCloudActionRule(
      result.cloudEvents as unknown as Parameters<
        typeof evaluateSuspiciousCloudActionRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateSuspiciousCloudActionRule
      >[1],
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
        {
          ref: 'web_server_service_account',
          attributes: {
            department: 'IT',
            job_title: 'Service Account',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'web_server_device',
          attributes: { hostname: 'WEB-PROD-01', os_platform: 'linux' },
        },
      ],
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
      false_positive_bait: [
        {
          event_template_id: 'web_legitimate_monitoring_v1',
          count: 4,
          device_ref: 'web_server_device',
        },
      ],
    },
  };
}

describe('generateTelemetry — web shell scenario (§7.2, §8.2, §10.3)', () => {
  const techniqueIdBySlug = new Map([['T1505.003', randomUUID()]]);

  it('produces one initial-access GET and a burst of POST commands, all on the web server device', () => {
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);
    const webServer = result.devices.find((d) => d.hostname === 'WEB-PROD-01')!;
    const groundTruth = result.httpRequests.filter(
      (h) => h.isGroundTruthEvidence,
    );

    expect(groundTruth.every((h) => h.deviceId === webServer.id)).toBe(true);
    expect(groundTruth.filter((h) => h.method === 'GET')).toHaveLength(1);
    expect(
      groundTruth.filter((h) => h.method === 'POST').length,
    ).toBeGreaterThanOrEqual(5);
    expect(new Set(groundTruth.map((h) => h.url)).size).toBe(1);
  });

  it('generates the configured false-positive monitoring bait on the same device, unmarked as ground truth', () => {
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);
    const webServer = result.devices.find((d) => d.hostname === 'WEB-PROD-01')!;

    const noise = result.httpRequests.filter((h) => !h.isGroundTruthEvidence);
    expect(noise).toHaveLength(4);
    expect(
      noise.every(
        (h) => h.deviceId === webServer.id && h.url === '/api/health-check.php',
      ),
    ).toBe(true);
  });

  it("feeds the Alert Engine's web-shell-access rule, firing on both the attack and the ambiguous monitoring bait (§8.6)", async () => {
    const { evaluateWebShellAccessRule } =
      await import('../alert-engine/rules');
    const def = buildWebShellDefinition();
    const result = generateTelemetry(randomUUID(), 31n, def, techniqueIdBySlug);

    const candidates = evaluateWebShellAccessRule(
      result.httpRequests as unknown as Parameters<
        typeof evaluateWebShellAccessRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateWebShellAccessRule
      >[1],
    );

    expect(candidates).toHaveLength(2);
    const webshellCandidate = candidates.find((c) =>
      c.title.includes('x7f2a9c.php'),
    );
    const monitoringCandidate = candidates.find((c) =>
      c.title.includes('health-check.php'),
    );
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
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Systems Administrator',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'IT-WKS-11', os_platform: 'windows' },
        },
      ],
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
      false_positive_bait: [
        {
          event_template_id: 'legitimate_startup_shortcut_v1',
          count: 2,
          device_ref: 'victim_device_1',
        },
      ],
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
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'IT-WKS-11',
    )!;

    const groundTruthProcesses = result.processEvents.filter(
      (p) => p.isGroundTruthEvidence,
    );
    const groundTruthFiles = result.fileEvents.filter(
      (f) => f.isGroundTruthEvidence,
    );
    const groundTruthNetwork = result.networkEvents.filter(
      (n) => n.isGroundTruthEvidence,
    );

    expect(groundTruthProcesses).toHaveLength(1);
    expect(groundTruthProcesses[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthProcesses[0].imagePath.toLowerCase()).toContain(
      'powershell.exe',
    );

    expect(groundTruthFiles).toHaveLength(1);
    expect(groundTruthFiles[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthFiles[0].filePath).toContain(
      '\\Start Menu\\Programs\\Startup\\',
    );

    expect(groundTruthNetwork.length).toBeGreaterThanOrEqual(4);
    expect(
      groundTruthNetwork.every((n) => n.deviceId === victimDevice.id),
    ).toBe(true);
  });

  it('threads the same processGuid through the PowerShell process and the C2 beacon (correlatable in the Device Portal)', () => {
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);
    const process = result.processEvents.find((p) => p.isGroundTruthEvidence)!;
    const beacons = result.networkEvents.filter((n) => n.isGroundTruthEvidence);

    expect(beacons.every((b) => b.processGuid === process.processGuid)).toBe(
      true,
    );
  });

  it('generates the configured false-positive Startup-shortcut bait on the same device, unmarked as ground truth', () => {
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'IT-WKS-11',
    )!;

    const noise = result.fileEvents.filter((f) => !f.isGroundTruthEvidence);
    expect(noise).toHaveLength(2);
    expect(
      noise.every(
        (f) =>
          f.deviceId === victimDevice.id &&
          f.filePath.includes('\\Start Menu\\Programs\\Startup\\'),
      ),
    ).toBe(true);
  });

  it("feeds the Alert Engine's persistence-artifact rule, firing on both the real backdoor and the benign bait (§8.6)", async () => {
    const { evaluatePersistenceArtifactRule } =
      await import('../alert-engine/rules');
    const def = buildFilelessMalwareDefinition();
    const result = generateTelemetry(randomUUID(), 41n, def, techniqueIdBySlug);

    const candidates = evaluatePersistenceArtifactRule(
      result.fileEvents as unknown as Parameters<
        typeof evaluatePersistenceArtifactRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluatePersistenceArtifactRule
      >[1],
    );

    expect(candidates).toHaveLength(3);
    const realCandidate = candidates.find((c) =>
      c.title.includes('WinSvcHelper.lnk'),
    );
    const baitCandidates = candidates.filter((c) =>
      c.title.includes('OneDrive.lnk'),
    );
    expect(realCandidate).toBeDefined();
    expect(baitCandidates).toHaveLength(2);
  });
});

function buildCredentialDumpingDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Systems Administrator',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'IT-WKS-07', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — credential dumping via LSASS scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1003.001', randomUUID()],
    ['T1071.001', randomUUID()],
  ]);

  it('produces a rundll32/comsvcs.dll process, a dump file, and a beacon burst, all on the victim device', () => {
    const def = buildCredentialDumpingDefinition();
    const result = generateTelemetry(randomUUID(), 71n, def, techniqueIdBySlug);
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'IT-WKS-07',
    )!;

    const groundTruthProcesses = result.processEvents.filter(
      (p) => p.isGroundTruthEvidence,
    );
    const groundTruthFiles = result.fileEvents.filter(
      (f) => f.isGroundTruthEvidence,
    );
    const groundTruthNetwork = result.networkEvents.filter(
      (n) => n.isGroundTruthEvidence,
    );

    expect(groundTruthProcesses).toHaveLength(1);
    expect(groundTruthProcesses[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthProcesses[0].commandLine.toLowerCase()).toContain(
      'comsvcs.dll',
    );
    expect(groundTruthProcesses[0].commandLine.toLowerCase()).toContain(
      'minidump',
    );

    expect(groundTruthFiles).toHaveLength(1);
    expect(groundTruthFiles[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthFiles[0].filePath).toBe(
      'C:\\Windows\\Temp\\lsass_dbg.dmp',
    );

    expect(groundTruthNetwork.length).toBeGreaterThanOrEqual(4);
  });

  it("feeds the Alert Engine's credential-dumping rule", async () => {
    const { evaluateCredentialDumpingRule } =
      await import('../alert-engine/rules');
    const def = buildCredentialDumpingDefinition();
    const result = generateTelemetry(randomUUID(), 71n, def, techniqueIdBySlug);

    const candidates = evaluateCredentialDumpingRule(
      result.processEvents as unknown as Parameters<
        typeof evaluateCredentialDumpingRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateCredentialDumpingRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
  });
});

function buildInsiderUsbCopyDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Sales',
            job_title: 'Account Executive',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'SLS-WKS-09', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — insider bulk USB copy scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1052.001', randomUUID()],
    ['T1070.004', randomUUID()],
  ]);

  it('produces a burst of removable-media file creations and matching source-file deletions', () => {
    const def = buildInsiderUsbCopyDefinition();
    const result = generateTelemetry(randomUUID(), 91n, def, techniqueIdBySlug);
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'SLS-WKS-09',
    )!;

    const groundTruthFiles = result.fileEvents.filter(
      (f) => f.isGroundTruthEvidence,
    );
    const copies = groundTruthFiles.filter((f) => f.action === 'created');
    const deletions = groundTruthFiles.filter((f) => f.action === 'deleted');

    expect(copies.length).toBeGreaterThanOrEqual(5);
    expect(
      copies.every(
        (f) =>
          f.deviceId === victimDevice.id &&
          f.filePath.startsWith('E:\\Backup\\'),
      ),
    ).toBe(true);
    expect(deletions.length).toBeGreaterThanOrEqual(5);
    expect(
      deletions.every(
        (f) => f.deviceId === victimDevice.id && !f.filePath.startsWith('E:\\'),
      ),
    ).toBe(true);
  });

  it("feeds the Alert Engine's removable-media-copy rule but not the source deletions (portal-discoverable only)", async () => {
    const { evaluateRemovableMediaCopyRule } =
      await import('../alert-engine/rules');
    const def = buildInsiderUsbCopyDefinition();
    const result = generateTelemetry(randomUUID(), 91n, def, techniqueIdBySlug);

    const candidates = evaluateRemovableMediaCopyRule(
      result.fileEvents as unknown as Parameters<
        typeof evaluateRemovableMediaCopyRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateRemovableMediaCopyRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs.length).toBeGreaterThanOrEqual(5);
  });
});

function buildCloudBucketExposureDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Cloud Platform Engineer',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — cloud bucket public exposure scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([['T1530', randomUUID()]]);

  it('produces a PutBucketPolicy event followed by a burst of object-access events', () => {
    const def = buildCloudBucketExposureDefinition();
    const result = generateTelemetry(
      randomUUID(),
      111n,
      def,
      techniqueIdBySlug,
    );
    const victim = result.identities.find(
      (i) => i.jobTitle === 'Cloud Platform Engineer',
    )!;

    const groundTruthCloud = result.cloudEvents.filter(
      (c) => c.isGroundTruthEvidence,
    );
    const policyChanges = groundTruthCloud.filter(
      (c) => c.actionName === 'PutBucketPolicy',
    );
    const accessBurst = groundTruthCloud.filter(
      (c) => c.actionName === 'GetObject' || c.actionName === 'ListBucket',
    );

    expect(policyChanges).toHaveLength(1);
    expect(policyChanges[0].identityId).toBe(victim.id);
    expect(accessBurst.length).toBeGreaterThanOrEqual(6);
    expect(accessBurst.every((c) => c.identityId === victim.id)).toBe(true);
  });

  it("feeds the Alert Engine's suspicious-cloud-action rule via the existing PutBucketPolicy signal", async () => {
    const { evaluateSuspiciousCloudActionRule } =
      await import('../alert-engine/rules');
    const def = buildCloudBucketExposureDefinition();
    const result = generateTelemetry(
      randomUUID(),
      111n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateSuspiciousCloudActionRule(
      result.cloudEvents as unknown as Parameters<
        typeof evaluateSuspiciousCloudActionRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateSuspiciousCloudActionRule
      >[1],
    );
    expect(candidates.some((c) => c.title.includes('PutBucketPolicy'))).toBe(
      true,
    );
  });
});

function buildWebSqliDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'web_server_service_account',
          attributes: {
            department: 'IT',
            job_title: 'Service Account',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'web_server_device',
          attributes: { hostname: 'WEB-PROD-02', os_platform: 'linux' },
        },
      ],
      decoy_population_size: { identities: 4, devices: 4 },
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
      false_positive_bait: [
        {
          event_template_id: 'web_legitimate_monitoring_v1',
          count: 2,
          device_ref: 'web_server_device',
        },
      ],
    },
  };
}

describe('generateTelemetry — web SQL injection scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([['T1190', randomUUID()]]);

  it('produces a probe burst and a UNION SELECT exfil request, all on the web server device', () => {
    const def = buildWebSqliDefinition();
    const result = generateTelemetry(
      randomUUID(),
      131n,
      def,
      techniqueIdBySlug,
    );
    const webServer = result.devices.find((d) => d.hostname === 'WEB-PROD-02')!;

    const groundTruthHttp = result.httpRequests.filter(
      (h) => h.isGroundTruthEvidence,
    );
    expect(groundTruthHttp.length).toBeGreaterThanOrEqual(5);
    expect(groundTruthHttp.every((h) => h.deviceId === webServer.id)).toBe(
      true,
    );
    expect(
      groundTruthHttp.some((h) => h.url.toLowerCase().includes('union')),
    ).toBe(true);
  });

  it("feeds the Alert Engine's SQL-injection rule, ignoring unrelated monitoring traffic", async () => {
    const { evaluateSqlInjectionRule } = await import('../alert-engine/rules');
    const def = buildWebSqliDefinition();
    const result = generateTelemetry(
      randomUUID(),
      131n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateSqlInjectionRule(
      result.httpRequests as unknown as Parameters<
        typeof evaluateSqlInjectionRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateSqlInjectionRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs.length).toBeGreaterThanOrEqual(5);
  });
});

function buildRansomwareDataTheftDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Systems Administrator',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'IT-WKS-15', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — ransomware double-extortion scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1048', randomUUID()],
    ['T1486', randomUUID()],
  ]);

  it('produces a large-volume outbound exfil burst followed by mass file encryption, single device', () => {
    const def = buildRansomwareDataTheftDefinition();
    const result = generateTelemetry(
      randomUUID(),
      151n,
      def,
      techniqueIdBySlug,
    );
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'IT-WKS-15',
    )!;

    const groundTruthNetwork = result.networkEvents.filter(
      (n) => n.isGroundTruthEvidence,
    );
    const groundTruthFiles = result.fileEvents.filter(
      (f) => f.isGroundTruthEvidence,
    );

    expect(groundTruthNetwork.length).toBeGreaterThanOrEqual(4);
    expect(
      groundTruthNetwork.every(
        (n) => n.deviceId === victimDevice.id && n.bytesSent >= 50_000_000,
      ),
    ).toBe(true);
    expect(
      groundTruthFiles.filter((f) => f.action === 'encrypted').length,
    ).toBeGreaterThanOrEqual(5);
    expect(groundTruthFiles.every((f) => f.deviceId === victimDevice.id)).toBe(
      true,
    );
  });

  it("feeds the Alert Engine's existing mass-encryption rule (the exfil step is portal-discoverable only)", async () => {
    const { evaluateMassEncryptionRule } =
      await import('../alert-engine/rules');
    const def = buildRansomwareDataTheftDefinition();
    const result = generateTelemetry(
      randomUUID(),
      151n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateMassEncryptionRule(
      result.fileEvents as unknown as Parameters<
        typeof evaluateMassEncryptionRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateMassEncryptionRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
  });
});

function buildTrojanScheduledTaskDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Engineering',
            job_title: 'Software Engineer',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'ENG-WKS-21', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — trojanized installer + scheduled task scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1204.002', randomUUID()],
    ['T1053.005', randomUUID()],
    ['T1071.001', randomUUID()],
  ]);

  it('produces installer + dropped payload process events, a scheduled task creation, and a beacon burst', () => {
    const def = buildTrojanScheduledTaskDefinition();
    const result = generateTelemetry(
      randomUUID(),
      171n,
      def,
      techniqueIdBySlug,
    );
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'ENG-WKS-21',
    )!;

    const groundTruthProcesses = result.processEvents.filter(
      (p) => p.isGroundTruthEvidence,
    );
    const groundTruthFiles = result.fileEvents.filter(
      (f) => f.isGroundTruthEvidence,
    );
    const groundTruthNetwork = result.networkEvents.filter(
      (n) => n.isGroundTruthEvidence,
    );

    expect(groundTruthProcesses).toHaveLength(3); // installer, dropped payload, schtasks.exe
    expect(
      groundTruthProcesses.every((p) => p.deviceId === victimDevice.id),
    ).toBe(true);
    expect(
      groundTruthProcesses.some((p) =>
        p.imagePath.includes('Adobe_Reader_Update_Setup.exe'),
      ),
    ).toBe(true);
    expect(
      groundTruthProcesses.some((p) =>
        p.imagePath.toLowerCase().includes('schtasks.exe'),
      ),
    ).toBe(true);

    expect(groundTruthFiles).toHaveLength(1);
    expect(groundTruthFiles[0].filePath).toContain('svc_helper.exe');

    expect(groundTruthNetwork.length).toBeGreaterThanOrEqual(4);
  });

  it("feeds the Alert Engine's scheduled-task-persistence rule", async () => {
    const { evaluateScheduledTaskPersistenceRule } =
      await import('../alert-engine/rules');
    const def = buildTrojanScheduledTaskDefinition();
    const result = generateTelemetry(
      randomUUID(),
      171n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateScheduledTaskPersistenceRule(
      result.processEvents as unknown as Parameters<
        typeof evaluateScheduledTaskPersistenceRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateScheduledTaskPersistenceRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toContain('ENG-WKS-21');
  });
});

function buildOAuthConsentGrantDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Human Resources',
            job_title: 'HR Generalist',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — OAuth illicit consent grant scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1566.002', randomUUID()],
    ['T1528', randomUUID()],
    ['T1114.002', randomUUID()],
  ]);

  it('produces a phishing email, a consent-grant cloud event, and a mailbox-access burst, all for the victim identity', () => {
    const def = buildOAuthConsentGrantDefinition();
    const result = generateTelemetry(
      randomUUID(),
      211n,
      def,
      techniqueIdBySlug,
    );
    const victim = result.identities.find(
      (i) => i.jobTitle === 'HR Generalist',
    )!;

    const groundTruthEmails = result.emailMessages.filter(
      (e) => e.isGroundTruthEvidence,
    );
    const groundTruthCloud = result.cloudEvents.filter(
      (c) => c.isGroundTruthEvidence,
    );
    const consentEvents = groundTruthCloud.filter(
      (c) => c.actionName === 'ConsentToApplication',
    );
    const mailAccessEvents = groundTruthCloud.filter(
      (c) => c.actionName === 'MailItemsAccessed',
    );

    expect(groundTruthEmails).toHaveLength(1);
    expect(groundTruthEmails[0].recipientAddresses).toContain(
      victim.userPrincipalName,
    );

    expect(consentEvents).toHaveLength(1);
    expect(consentEvents[0].identityId).toBe(victim.id);
    expect(consentEvents[0].resourceId).toBe('Office Sync Helper');

    expect(mailAccessEvents.length).toBeGreaterThanOrEqual(5);
    expect(
      mailAccessEvents.every(
        (c) =>
          c.identityId === victim.id && c.resourceId === 'Office Sync Helper',
      ),
    ).toBe(true);
    // The consent click is the victim's own action; the subsequent app activity is the attacker's.
    expect(
      mailAccessEvents.every((c) => c.sourceIp !== consentEvents[0].sourceIp),
    ).toBe(true);
  });

  it("feeds the Alert Engine's OAuth-consent-grant rule", async () => {
    const { evaluateOAuthConsentGrantRule } =
      await import('../alert-engine/rules');
    const def = buildOAuthConsentGrantDefinition();
    const result = generateTelemetry(
      randomUUID(),
      211n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateOAuthConsentGrantRule(
      result.cloudEvents as unknown as Parameters<
        typeof evaluateOAuthConsentGrantRule
      >[0],
      result.identities as unknown as Parameters<
        typeof evaluateOAuthConsentGrantRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('identity');
    expect(candidates[0].evidenceRefs.length).toBeGreaterThanOrEqual(6);
  });
});

function buildKerberoastingDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Systems Administrator',
            home_country: 'US',
          },
        },
        {
          ref: 'service_account_identity_1',
          attributes: {
            department: 'IT',
            job_title: 'Service Account',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'IT-WKS-11', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — Kerberoasting service-account pivot scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1558.003', randomUUID()],
    ['T1078.002', randomUUID()],
  ]);

  it('produces a Rubeus-style ticket request on the admin workstation and a risky sign-in for the service account', () => {
    const def = buildKerberoastingDefinition();
    const result = generateTelemetry(
      randomUUID(),
      231n,
      def,
      techniqueIdBySlug,
    );
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'IT-WKS-11',
    )!;
    const serviceAccount = result.identities.find(
      (i) => i.jobTitle === 'Service Account',
    )!;

    const groundTruthProcesses = result.processEvents.filter(
      (p) => p.isGroundTruthEvidence,
    );
    const groundTruthSignIns = result.signInEvents.filter(
      (s) => s.isGroundTruthEvidence,
    );

    expect(groundTruthProcesses).toHaveLength(1);
    expect(groundTruthProcesses[0].deviceId).toBe(victimDevice.id);
    expect(groundTruthProcesses[0].commandLine.toLowerCase()).toContain(
      'kerberoast',
    );

    expect(groundTruthSignIns).toHaveLength(1);
    expect(groundTruthSignIns[0].identityId).toBe(serviceAccount.id);
    expect(groundTruthSignIns[0].result).toBe('success');
  });

  it("feeds the Alert Engine's Kerberoasting rule", async () => {
    const { evaluateKerberoastingRule } = await import('../alert-engine/rules');
    const def = buildKerberoastingDefinition();
    const result = generateTelemetry(
      randomUUID(),
      231n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateKerberoastingRule(
      result.processEvents as unknown as Parameters<
        typeof evaluateKerberoastingRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateKerberoastingRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
  });
});

function buildDnsTunnelingDefinition(): GroundTruthDefinition {
  return {
    metadata: {},
    population: {
      narrative_identities: [
        {
          ref: 'victim_identity_1',
          attributes: {
            department: 'Marketing',
            job_title: 'Marketing Coordinator',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [
        {
          ref: 'victim_device_1',
          attributes: { hostname: 'MKT-WKS-04', os_platform: 'windows' },
        },
      ],
      decoy_population_size: { identities: 5, devices: 4 },
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
    noise_profile: { false_positive_bait: [] },
  };
}

describe('generateTelemetry — DNS tunneling scenario (§7.2, §8.2)', () => {
  const techniqueIdBySlug = new Map([
    ['T1204.002', randomUUID()],
    ['T1071.004', randomUUID()],
    ['T1041', randomUUID()],
  ]);

  it('produces a backdoor execution followed by a DNS beacon and a higher-volume DNS exfil burst, all on the victim device', () => {
    const def = buildDnsTunnelingDefinition();
    const result = generateTelemetry(
      randomUUID(),
      251n,
      def,
      techniqueIdBySlug,
    );
    const victimDevice = result.devices.find(
      (d) => d.hostname === 'MKT-WKS-04',
    )!;

    const groundTruthProcesses = result.processEvents.filter(
      (p) => p.isGroundTruthEvidence,
    );
    const groundTruthNetwork = result.networkEvents.filter(
      (n) => n.isGroundTruthEvidence,
    );
    const dnsEvents = groundTruthNetwork.filter((n) => n.remotePort === 53);

    expect(groundTruthProcesses).toHaveLength(1);
    expect(groundTruthProcesses[0].deviceId).toBe(victimDevice.id);

    expect(dnsEvents.length).toBeGreaterThanOrEqual(30);
    expect(
      dnsEvents.every(
        (n) => n.deviceId === victimDevice.id && n.protocol === 'udp',
      ),
    ).toBe(true);

    const totalSent = dnsEvents.reduce((sum, n) => sum + n.bytesSent, 0);
    const avgSent = totalSent / dnsEvents.length;
    expect(avgSent).toBeGreaterThan(120); // the larger exfil burst pulls the average up past pure-beacon size
  });

  it("feeds the Alert Engine's DNS-tunneling rule, citing both the beacon and exfil bursts as one alert", async () => {
    const { evaluateDnsTunnelingRule } = await import('../alert-engine/rules');
    const def = buildDnsTunnelingDefinition();
    const result = generateTelemetry(
      randomUUID(),
      251n,
      def,
      techniqueIdBySlug,
    );

    const candidates = evaluateDnsTunnelingRule(
      result.networkEvents as unknown as Parameters<
        typeof evaluateDnsTunnelingRule
      >[0],
      result.devices as unknown as Parameters<
        typeof evaluateDnsTunnelingRule
      >[1],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs.length).toBeGreaterThanOrEqual(30);
  });
});
