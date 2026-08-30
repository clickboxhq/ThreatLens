import { randomUUID } from 'crypto';
import { generateTelemetry, type GroundTruthDefinition } from './generator';

/**
 * Password spraying, password guessing and credential stuffing are all T1110, all arrive from
 * one source address, and all consist of failed sign-ins. An analyst who has only ever seen one
 * of them will describe the others wrongly, and the detection that catches each is different.
 *
 * These assert the three are actually *distinguishable in the generated telemetry* — that the
 * library teaches three separate shapes rather than three labels on one. Without this, a change
 * to any one template could quietly collapse the distinction the scenarios exist to teach.
 */

const TECHNIQUES = new Map<string, string>([
  ['T1110.001', randomUUID()],
  ['T1110.003', randomUUID()],
  ['T1110.004', randomUUID()],
  ['T1078', randomUUID()],
]);

function definitionWith(
  templateId: string,
  techniqueId: string,
): GroundTruthDefinition {
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
      decoy_population_size: { identities: 14, devices: 4 },
      world_time_window_hours: 24,
    },
    kill_chain: [
      {
        step_order: 1,
        mitre_technique_id: techniqueId,
        entity_ref: 'victim_identity_1',
        event_template_id: templateId,
        relative_timestamp: '+4h',
        correlation_group: 'g1',
        is_required_for_full_credit: true,
      },
    ],
    noise_profile: { signal_to_noise_ratio: 0, false_positive_bait: [] },
    scoring_rubric: {
      required_techniques: [techniqueId],
      required_verdict: 'true_positive',
      min_evidence_items: 1,
      containment_expectations: [],
    },
    hints: [],
  } as unknown as GroundTruthDefinition;
}

function attemptsFor(templateId: string, techniqueId: string) {
  const result = generateTelemetry(
    randomUUID(),
    99n,
    definitionWith(templateId, techniqueId),
    TECHNIQUES,
  );
  const attack = result.signInEvents.filter((e) => e.isGroundTruthEvidence);
  const byIdentity = new Map<string, number>();
  for (const e of attack) {
    byIdentity.set(e.identityId, (byIdentity.get(e.identityId) ?? 0) + 1);
  }
  return {
    total: attack.length,
    identities: byIdentity.size,
    maxPerIdentity: Math.max(...byIdentity.values()),
    sourceIps: new Set(attack.map((e) => e.sourceIp)).size,
    successes: attack.filter((e) => e.result === 'success').length,
  };
}

describe('the three credential-attack shapes are distinguishable', () => {
  it('password guessing concentrates many attempts on ONE account', () => {
    const s = attemptsFor('brute_force_single_account_v1', 'T1110.001');

    expect(s.identities).toBe(1);
    expect(s.total).toBeGreaterThanOrEqual(28);
    // The signature: high volume, one target. A per-account threshold fires immediately.
    expect(s.maxPerIdentity).toBe(s.total);
  });

  it('password spraying spreads a LITTLE volume across MANY accounts', () => {
    const s = attemptsFor('password_spray_batch_v1', 'T1110.003');

    expect(s.identities).toBeGreaterThan(1);
    // Deliberately low per account — that is how spraying evades a per-account threshold.
    expect(s.maxPerIdentity).toBeLessThanOrEqual(2);
  });

  it('credential stuffing makes exactly ONE attempt per account', () => {
    const s = attemptsFor('credential_stuffing_batch_v1', 'T1110.004');

    expect(s.identities).toBeGreaterThan(8);
    // One each. Lower per-account volume than even spraying, which is why neither a
    // per-account nor a naive per-attempt rule catches it.
    expect(s.maxPerIdentity).toBe(1);
  });

  it('only stuffing produces a success, because the password was already known', () => {
    // Guessing and spraying in these templates are failed campaigns; stuffing lands because
    // somebody reused a password that leaked elsewhere. That difference is the lesson.
    expect(
      attemptsFor('brute_force_single_account_v1', 'T1110.001').successes,
    ).toBe(0);
    expect(
      attemptsFor('credential_stuffing_batch_v1', 'T1110.004').successes,
    ).toBe(1);
  });

  it('all three come from a single source address, so the source cannot be the tell', () => {
    // If the source distinguished them, the exercise would be trivial. It does not — the
    // distribution across accounts is what an analyst has to read.
    for (const [template, technique] of [
      ['brute_force_single_account_v1', 'T1110.001'],
      ['password_spray_batch_v1', 'T1110.003'],
      ['credential_stuffing_batch_v1', 'T1110.004'],
    ] as const) {
      expect(attemptsFor(template, technique).sourceIps).toBe(1);
    }
  });
});

/**
 * IDOR against its own control case. The two produce deliberately similar traffic — sequential
 * identifiers, uniform 200s, one source — because that similarity is the exercise. What has to
 * survive is the evidence that separates them: who is calling, and from where.
 */
describe('IDOR is distinguishable from the benign batch export', () => {
  function httpFor(templateId: string) {
    const def = definitionWith(templateId, 'T1078');
    (
      def as unknown as { population: { narrative_devices: unknown[] } }
    ).population.narrative_devices = [
      {
        ref: 'web_server_1',
        attributes: { hostname: 'WEB-PROD-03', os_platform: 'linux' },
      },
    ];
    (
      def as unknown as { kill_chain: { device_ref?: string }[] }
    ).kill_chain[0].device_ref = 'web_server_1';
    const result = generateTelemetry(randomUUID(), 7n, def, TECHNIQUES);
    return result.httpRequests;
  }

  it('IDOR requests are attributed to a signed-in person', () => {
    const reqs = httpFor('web_idor_enumeration_v1');
    expect(reqs.length).toBeGreaterThan(20);
    // Attribution is the finding: a named account reading records one after another.
    expect(reqs.every((r) => r.identityId !== null)).toBe(true);
  });

  it('the benign export is NOT attributed to a person, and comes from inside', () => {
    const reqs = httpFor('legitimate_batch_export_v1');
    expect(reqs.every((r) => r.identityId === null)).toBe(true);
    expect(reqs.every((r) => r.sourceIp.startsWith('10.'))).toBe(true);
  });

  it('both walk consecutive identifiers, so the shape alone cannot separate them', () => {
    for (const template of [
      'web_idor_enumeration_v1',
      'legitimate_batch_export_v1',
    ]) {
      const ids = httpFor(template)
        .map((r) => Number(r.url.split('/').pop()))
        .sort((a, b) => a - b);
      expect(ids[ids.length - 1] - ids[0]).toBe(ids.length - 1);
    }
  });

  it('every IDOR request succeeds — the server authorises none of them', () => {
    // A mix of 200s and 403s would mean access control partially worked. It does not.
    expect(
      httpFor('web_idor_enumeration_v1').every((r) => r.statusCode === 200),
    ).toBe(true);
  });

  it('the benign export is marked as noise, not ground truth', () => {
    expect(
      httpFor('legitimate_batch_export_v1').every(
        (r) => r.isGroundTruthEvidence === false,
      ),
    ).toBe(true);
  });
});

/**
 * The IDOR scenario ships its control case as false-positive bait rather than a kill-chain
 * step. Bait only receives a device when the entry declares device_ref, and both web templates
 * short-circuit without one — so a missing device_ref silently produced a scenario with no
 * contrast at all, which is the entire point of that scenario. Nothing failed; the benign
 * traffic simply was not there.
 */
describe('device-scoped bait actually generates', () => {
  function withBait(deviceRef: string | undefined) {
    const def = definitionWith('web_idor_enumeration_v1', 'T1078');
    const d = def as unknown as {
      population: { narrative_devices: unknown[] };
      kill_chain: { device_ref?: string }[];
      noise_profile: {
        false_positive_bait: {
          event_template_id: string;
          count: number;
          device_ref?: string;
        }[];
      };
    };
    d.population.narrative_devices = [
      {
        ref: 'web_server_1',
        attributes: { hostname: 'WEB-PROD-03', os_platform: 'linux' },
      },
    ];
    d.kill_chain[0].device_ref = 'web_server_1';
    d.noise_profile.false_positive_bait = [
      {
        event_template_id: 'legitimate_batch_export_v1',
        count: 1,
        ...(deviceRef ? { device_ref: deviceRef } : {}),
      },
    ];
    return generateTelemetry(randomUUID(), 11n, def, TECHNIQUES).httpRequests;
  }

  it('produces both the attack run and the benign run when bait names a device', () => {
    const reqs = withBait('web_server_1');
    expect(reqs.filter((r) => r.isGroundTruthEvidence).length).toBeGreaterThan(
      20,
    );
    // The contrast the scenario exists to teach.
    expect(reqs.filter((r) => !r.isGroundTruthEvidence).length).toBeGreaterThan(
      10,
    );
  });

  it('produces no benign run at all when bait omits the device — the original bug', () => {
    expect(
      withBait(undefined).filter((r) => !r.isGroundTruthEvidence).length,
    ).toBe(0);
  });
});
