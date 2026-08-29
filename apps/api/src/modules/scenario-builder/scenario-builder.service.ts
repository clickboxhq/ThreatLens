import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import {
  EVENT_TEMPLATES,
  EVENT_TEMPLATE_IDS,
  DEVICE_REQUIRED_TEMPLATE_IDS,
  NARRATIVE_HOME_COUNTRIES,
  NARRATIVE_OS_PLATFORMS,
} from './event-templates';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  AuthoredGroundTruthDefinition,
  CreateScenarioDto,
} from './dto/scenario-builder.dto';

const RELATIVE_TIMESTAMP_RE = /^\+\d+h(\d+m)?$/;
const REQUIRED_VERDICTS = [
  'true_positive',
  'false_positive',
  'benign_positive',
];

@Injectable()
export class ScenarioBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return EVENT_TEMPLATES;
  }

  async validate(def: AuthoredGroundTruthDefinition): Promise<string[]> {
    const errors: string[] = [];
    const knownTechniqueIds = new Set(
      (
        await this.prisma.mitreTechnique.findMany({
          select: { techniqueId: true },
        })
      ).map((t) => t.techniqueId),
    );

    if (
      !def?.population ||
      !def?.kill_chain ||
      !def?.noise_profile ||
      !def?.scoring_rubric
    ) {
      return [
        'Definition is missing one of population, kill_chain, noise_profile, or scoring_rubric.',
      ];
    }

    const identities = def.population.narrative_identities ?? [];
    const devices = def.population.narrative_devices ?? [];
    const identityRefs = new Set(identities.map((i) => i.ref));
    const deviceRefs = new Set(devices.map((d) => d.ref));

    if (identities.length === 0) {
      errors.push('At least one narrative identity is required.');
    }
    if (identityRefs.size !== identities.length) {
      errors.push('Narrative identity refs must be unique.');
    }
    if (deviceRefs.size !== devices.length) {
      errors.push('Narrative device refs must be unique.');
    }
    for (const identity of identities) {
      if (!identity.ref) errors.push('Every narrative identity needs a ref.');
      if (!identity.attributes) {
        errors.push(
          `Identity "${identity.ref}" is missing its attributes object.`,
        );
        continue;
      }
      if (!identity.attributes.department)
        errors.push(`Identity "${identity.ref}" is missing a department.`);
      if (!identity.attributes.job_title)
        errors.push(`Identity "${identity.ref}" is missing a job_title.`);
      if (
        !(NARRATIVE_HOME_COUNTRIES as readonly string[]).includes(
          identity.attributes.home_country,
        )
      ) {
        errors.push(
          `Identity "${identity.ref}": home_country must be one of ${NARRATIVE_HOME_COUNTRIES.join(', ')} — the only ones the generator's geo lookup recognizes.`,
        );
      }
    }
    for (const device of devices) {
      if (!device.ref) errors.push('Every narrative device needs a ref.');
      if (!device.attributes) {
        errors.push(`Device "${device.ref}" is missing its attributes object.`);
        continue;
      }
      if (!device.attributes.hostname)
        errors.push(`Device "${device.ref}" is missing a hostname.`);
      if (
        !(NARRATIVE_OS_PLATFORMS as readonly string[]).includes(
          device.attributes.os_platform,
        )
      ) {
        errors.push(
          `Device "${device.ref}": os_platform must be one of ${NARRATIVE_OS_PLATFORMS.join(', ')}.`,
        );
      }
    }
    const decoy = def.population.decoy_population_size;
    if (!decoy || decoy.identities < 0 || decoy.devices < 0) {
      errors.push(
        'decoy_population_size.identities/devices must be zero or more.',
      );
    }
    if (
      !def.population.world_time_window_hours ||
      def.population.world_time_window_hours < 1 ||
      def.population.world_time_window_hours > 168
    ) {
      errors.push(
        'world_time_window_hours must be between 1 and 168 (one week).',
      );
    }

    const killChain = def.kill_chain ?? [];
    if (killChain.length === 0) {
      errors.push('At least one kill-chain step is required.');
    }
    const usedTechniques = new Set<string>();
    const seenStepOrders = new Set<number>();
    for (const step of killChain) {
      if (seenStepOrders.has(step.step_order)) {
        errors.push(`Duplicate kill-chain step_order ${step.step_order}.`);
      }
      seenStepOrders.add(step.step_order);

      if (!EVENT_TEMPLATE_IDS.has(step.event_template_id)) {
        errors.push(
          `Step ${step.step_order}: "${step.event_template_id}" isn't a real event template — only the templates the Telemetry Generator can actually render are usable.`,
        );
      }
      if (!identityRefs.has(step.entity_ref)) {
        errors.push(
          `Step ${step.step_order}: entity_ref "${step.entity_ref}" doesn't match any narrative identity.`,
        );
      }
      if (DEVICE_REQUIRED_TEMPLATE_IDS.has(step.event_template_id)) {
        if (!step.device_ref) {
          errors.push(
            `Step ${step.step_order}: template "${step.event_template_id}" writes device-scoped events and requires a device_ref.`,
          );
        } else if (!deviceRefs.has(step.device_ref)) {
          errors.push(
            `Step ${step.step_order}: device_ref "${step.device_ref}" doesn't match any narrative device.`,
          );
        }
      }
      if (!knownTechniqueIds.has(step.mitre_technique_id)) {
        errors.push(
          `Step ${step.step_order}: "${step.mitre_technique_id}" isn't a real MITRE technique id.`,
        );
      } else {
        usedTechniques.add(step.mitre_technique_id);
      }
      if (!RELATIVE_TIMESTAMP_RE.test(step.relative_timestamp ?? '')) {
        errors.push(
          `Step ${step.step_order}: relative_timestamp "${step.relative_timestamp}" must look like "+2h" or "+2h30m" — anything else silently generates at time zero.`,
        );
      }
      if (!step.correlation_group) {
        errors.push(`Step ${step.step_order} is missing a correlation_group.`);
      }
    }

    const bait = def.noise_profile.false_positive_bait ?? [];
    for (const b of bait) {
      if (!EVENT_TEMPLATE_IDS.has(b.event_template_id)) {
        errors.push(
          `Noise bait: "${b.event_template_id}" isn't a real event template.`,
        );
      }
      if (!b.count || b.count < 1) {
        errors.push(
          `Noise bait "${b.event_template_id}": count must be at least 1.`,
        );
      }
      if (DEVICE_REQUIRED_TEMPLATE_IDS.has(b.event_template_id)) {
        if (!b.device_ref || !deviceRefs.has(b.device_ref)) {
          errors.push(
            `Noise bait "${b.event_template_id}" writes device-scoped events and requires a valid device_ref.`,
          );
        }
      }
    }
    const ratio = def.noise_profile.signal_to_noise_ratio;
    if (ratio != null && (ratio <= 0 || ratio > 1)) {
      errors.push(
        'noise_profile.signal_to_noise_ratio must be between 0 (exclusive) and 1.',
      );
    }

    const rubric = def.scoring_rubric;
    const requiredTechniques = rubric.required_techniques ?? [];
    if (requiredTechniques.length === 0) {
      errors.push(
        'scoring_rubric.required_techniques needs at least one technique.',
      );
    }
    for (const t of requiredTechniques) {
      if (!knownTechniqueIds.has(t)) {
        errors.push(
          `Required technique "${t}" isn't a real MITRE technique id.`,
        );
      } else if (!usedTechniques.has(t)) {
        errors.push(
          `Required technique "${t}" never appears in the kill chain — a student could never earn it.`,
        );
      }
    }
    if (!REQUIRED_VERDICTS.includes(rubric.required_verdict)) {
      errors.push(
        `scoring_rubric.required_verdict must be one of ${REQUIRED_VERDICTS.join(', ')}.`,
      );
    }
    if (!rubric.min_evidence_items || rubric.min_evidence_items < 1) {
      errors.push('scoring_rubric.min_evidence_items must be at least 1.');
    } else if (rubric.min_evidence_items > killChain.length) {
      errors.push(
        `scoring_rubric.min_evidence_items (${rubric.min_evidence_items}) exceeds the number of kill-chain steps (${killChain.length}) — that many pieces of ground-truth evidence don't exist to pin.`,
      );
    }

    for (const hint of def.hints ?? []) {
      if (!hint.text) errors.push('Every hint needs text.');
      if (
        !hint.unlock_cost_percent ||
        hint.unlock_cost_percent <= 0 ||
        hint.unlock_cost_percent > 100
      ) {
        errors.push(
          "Every hint's unlock_cost_percent must be between 1 and 100.",
        );
      }
    }

    return errors;
  }

  async create(user: AuthenticatedUser, dto: CreateScenarioDto) {
    const errors = await this.validate(dto.groundTruthDefinition);
    if (errors.length > 0) {
      throw new AppException(400, 'INVALID_SCENARIO', errors.join(' '));
    }

    const existing = await this.prisma.attackScenario.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new AppException(
        409,
        'SLUG_TAKEN',
        'A scenario with this slug already exists.',
      );
    }

    const requiredTechniqueIds = [
      ...new Set(dto.groundTruthDefinition.scoring_rubric.required_techniques),
    ];
    const techniques = await this.prisma.mitreTechnique.findMany({
      where: { techniqueId: { in: requiredTechniqueIds } },
    });
    const techniqueRowIdBySlug = new Map(
      techniques.map((t) => [t.techniqueId, t.id]),
    );

    const scenarioId = randomUUID();
    const versionId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.attackScenario.create({
        data: {
          id: scenarioId,
          slug: dto.slug,
          title: dto.title,
          summary: dto.summary,
          category: dto.category,
          difficulty: dto.difficulty,
          estimatedMinutes: dto.estimatedMinutes,
          status: 'published',
          authorId: user.id,
        },
      }),
      this.prisma.scenarioVersion.create({
        data: {
          id: versionId,
          scenarioId,
          versionNumber: 1,
          groundTruthDefinition: dto.groundTruthDefinition as unknown as object,
          publishedAt: new Date(),
          createdBy: user.id,
        },
      }),
      this.prisma.attackScenario.update({
        where: { id: scenarioId },
        data: { currentVersionId: versionId },
      }),
      ...requiredTechniqueIds.map((slug) =>
        this.prisma.scenarioTechnique.create({
          data: {
            scenarioVersionId: versionId,
            mitreTechniqueId: techniqueRowIdBySlug.get(slug)!,
            isRequiredForFullCredit: true,
          },
        }),
      ),
    ]);

    return {
      id: scenarioId,
      slug: dto.slug,
      title: dto.title,
      summary: dto.summary,
      category: dto.category,
      difficulty: dto.difficulty,
      estimatedMinutes: dto.estimatedMinutes,
    };
  }
}
