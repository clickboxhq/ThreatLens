import { randomUUID } from 'crypto';
import { ScenarioBuilderService } from './scenario-builder.service';
import { generateTelemetry } from '../telemetry-generator/generator';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';
import type {
  AuthoredGroundTruthDefinition,
  CreateScenarioDto,
} from './dto/scenario-builder.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const KNOWN_TECHNIQUES = [
  { techniqueId: 'T1078', id: 'row-t1078' },
  { techniqueId: 'T1078.002', id: 'row-t1078-002' },
  { techniqueId: 'T1566.002', id: 'row-t1566-002' },
];

function buildUser(): AuthenticatedUser {
  return {
    id: 'instructor-1',
    role: 'instructor',
    orgId: null,
  } as AuthenticatedUser;
}

function buildService() {
  const prisma = {
    mitreTechnique: {
      findMany: jest.fn(async () => KNOWN_TECHNIQUES),
    },
    attackScenario: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async () => undefined),
      update: jest.fn(async () => undefined),
    },
    scenarioVersion: {
      create: jest.fn(async () => undefined),
    },
    scenarioTechnique: {
      create: jest.fn(async () => undefined),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const service = new ScenarioBuilderService(prisma as never);
  return { service, prisma };
}

// A minimal, real-shaped valid definition — mirrors the "Impossible Travel" scenario in
// apps/api/prisma/seed.ts, using two of the actual event templates from event-templates.ts.
function validDefinition(): AuthoredGroundTruthDefinition {
  return {
    population: {
      narrative_identities: [
        {
          ref: 'victim_1',
          attributes: {
            department: 'Legal',
            job_title: 'Compliance Analyst',
            home_country: 'US',
          },
        },
      ],
      narrative_devices: [],
      decoy_population_size: { identities: 10, devices: 6 },
      world_time_window_hours: 24,
    },
    kill_chain: [
      {
        step_order: 1,
        mitre_technique_id: 'T1078',
        entity_ref: 'victim_1',
        event_template_id: 'impossible_travel_first_signin_v1',
        relative_timestamp: '+5h',
        correlation_group: 'travel-1',
        is_required_for_full_credit: true,
      },
      {
        step_order: 2,
        mitre_technique_id: 'T1078',
        entity_ref: 'victim_1',
        event_template_id: 'impossible_travel_second_signin_v1',
        relative_timestamp: '+5h45m',
        correlation_group: 'travel-1',
        is_required_for_full_credit: true,
      },
    ],
    noise_profile: {
      signal_to_noise_ratio: 0.1,
      false_positive_bait: [
        { event_template_id: 'legitimate_travel_signin_v1', count: 1 },
      ],
    },
    scoring_rubric: {
      required_techniques: ['T1078'],
      required_verdict: 'true_positive',
      min_evidence_items: 2,
    },
    hints: [{ unlock_cost_percent: 5, text: 'Look at the sign-in timeline.' }],
  };
}

describe('ScenarioBuilderService.listTemplates', () => {
  it('returns the real, fixed template catalog', () => {
    const { service } = buildService();
    const templates = service.listTemplates();
    expect(templates.length).toBe(47);
    expect(
      templates.find((t) => t.id === 'impossible_travel_first_signin_v1'),
    ).toBeTruthy();
  });
});

describe('ScenarioBuilderService.validate', () => {
  it('accepts a real, correctly-shaped definition with no errors', async () => {
    const { service } = buildService();
    const errors = await service.validate(validDefinition());
    expect(errors).toEqual([]);
  });

  it('rejects an unknown event template id rather than silently accepting it', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.kill_chain[0].event_template_id = 'made_up_template_v1';
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('made_up_template_v1'))).toBe(true);
  });

  it('rejects an entity_ref that has no matching narrative identity', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.kill_chain[0].entity_ref = 'nobody';
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('nobody'))).toBe(true);
  });

  it('requires a device_ref for a device-scoped template', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.kill_chain[0].event_template_id = 'credential_dumping_lsass_dump_v1';
    // no device_ref set, and no narrative_devices defined at all
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('device_ref'))).toBe(true);
  });

  it('accepts a device-scoped template once a matching device_ref is supplied', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.population.narrative_devices = [
      {
        ref: 'device_1',
        attributes: { hostname: 'FIN-WKS-01', os_platform: 'windows' },
      },
    ];
    def.kill_chain[0].event_template_id = 'credential_dumping_lsass_dump_v1';
    def.kill_chain[0].device_ref = 'device_1';
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('device_ref'))).toBe(false);
  });

  it('rejects a home_country outside the 5 the generator recognizes', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.population.narrative_identities[0].attributes.home_country = 'FR';
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('home_country'))).toBe(true);
  });

  it('rejects a malformed relative_timestamp', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.kill_chain[0].relative_timestamp = 'tomorrow';
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('relative_timestamp'))).toBe(true);
  });

  it('rejects a required_techniques entry that never appears in the kill chain', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.scoring_rubric.required_techniques = ['T1566.002']; // real technique, unused in this kill chain
    const errors = await service.validate(def);
    expect(
      errors.some(
        (e) => e.includes('T1566.002') && e.includes('never appears'),
      ),
    ).toBe(true);
  });

  it('rejects min_evidence_items greater than the number of kill-chain steps', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.scoring_rubric.min_evidence_items = 5; // only 2 kill-chain steps exist
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('min_evidence_items'))).toBe(true);
  });

  it('rejects a narrative identity missing its attributes wrapper — the exact shape generator.ts requires, not a flattened one', async () => {
    const { service } = buildService();
    const def = validDefinition();
    // Deliberately malformed (as an unchecked HTTP payload could arrive) to prove validate()
    // catches it rather than trusting the TS type.
    def.population.narrative_identities[0] = {
      ref: 'victim_1',
      department: 'Legal',
    } as unknown as (typeof def.population.narrative_identities)[number];
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('attributes'))).toBe(true);
  });

  it('rejects an empty kill chain', async () => {
    const { service } = buildService();
    const def = validDefinition();
    def.kill_chain = [];
    const errors = await service.validate(def);
    expect(errors.some((e) => e.includes('kill-chain step is required'))).toBe(
      true,
    );
  });

  // The regression guard for the exact bug that shipped once: validate() and
  // generateTelemetry() must agree on the *real* shape (narrative.attributes.department,
  // not a flattened narrative.department) — a unit test that only checks validate() against
  // its own DTO type can't catch a mismatch against generator.ts's actual interface. This
  // feeds a definition that already passed validate() into the real generator and confirms
  // it produces real telemetry instead of throwing.
  it('produces real telemetry from a definition that already passed validate() — no drift between the two', async () => {
    const { service } = buildService();
    const def = validDefinition();
    expect(await service.validate(def)).toEqual([]);

    const techniqueIdBySlug = new Map(
      KNOWN_TECHNIQUES.map((t) => [t.techniqueId, t.id]),
    );
    // `metadata` is typed differently between the two interfaces (generator.ts's own
    // `metadata.world_time_window_hours` is itself dead — confirmed nothing reads it, the real
    // value lives at `population.world_time_window_hours`) — every field generateTelemetry
    // actually consumes is what this test is really checking type-compatibility on.
    const telemetry = generateTelemetry(
      randomUUID(),
      42n,
      def as unknown as GroundTruthDefinition,
      techniqueIdBySlug,
    );

    expect(telemetry.identities.length).toBeGreaterThan(0);
    expect(telemetry.signInEvents.length).toBeGreaterThan(0);
    expect(telemetry.signInEvents.some((e) => e.isGroundTruthEvidence)).toBe(
      true,
    );
  });
});

describe('ScenarioBuilderService.create', () => {
  const scenarioDto = (): CreateScenarioDto =>
    ({
      slug: 'new-impossible-travel',
      title: 'New Impossible Travel',
      summary: 'A test scenario.',
      category: 'identity',
      difficulty: 'beginner',
      estimatedMinutes: 15,
      groundTruthDefinition: validDefinition(),
    }) as CreateScenarioDto;

  it('rejects creation when the definition fails validation, before touching the database', async () => {
    const { service, prisma } = buildService();
    const dto = scenarioDto();
    dto.groundTruthDefinition.kill_chain = [];

    await expect(service.create(buildUser(), dto)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_SCENARIO',
    });
    expect(prisma.attackScenario.create).not.toHaveBeenCalled();
  });

  it('rejects a slug that already exists', async () => {
    const { service, prisma } = buildService();
    prisma.attackScenario.findUnique.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.create(buildUser(), scenarioDto()),
    ).rejects.toMatchObject({
      status: 409,
      code: 'SLUG_TAKEN',
    });
  });

  it('creates the scenario, its first version, and a ScenarioTechnique row per required technique', async () => {
    const { service, prisma } = buildService();

    const result = await service.create(buildUser(), scenarioDto());

    expect(prisma.attackScenario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'new-impossible-travel',
          status: 'published',
        }),
      }),
    );
    expect(prisma.scenarioVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNumber: 1 }),
      }),
    );
    expect(prisma.scenarioTechnique.create).toHaveBeenCalledTimes(1);
    expect(result.slug).toBe('new-impossible-travel');
  });
});
