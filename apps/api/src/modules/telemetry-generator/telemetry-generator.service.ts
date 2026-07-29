import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateTelemetry, GroundTruthDefinition } from './generator';

@Injectable()
export class TelemetryGeneratorService {
  private readonly logger = new Logger(TelemetryGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * §7.2 end-to-end: load the session's ground truth, run the pure generation pipeline,
   * and persist the result. Idempotent (§5.9, §3.8): if telemetry already exists for this
   * session, it is not regenerated, so a duplicate job delivery is a safe no-op.
   */
  async generateForSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.identity.count({ where: { sessionId } });
    if (existing > 0) {
      this.logger.log(`Session ${sessionId} already has telemetry; skipping (idempotent).`);
      return;
    }

    const session = await this.prisma.investigationSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scenarioVersion: true },
    });

    const def = session.scenarioVersion.groundTruthDefinition as unknown as GroundTruthDefinition;

    const requiredTechniqueSlugs = new Set(def.kill_chain.map((step) => step.mitre_technique_id));
    const techniques = await this.prisma.mitreTechnique.findMany({
      where: { techniqueId: { in: [...requiredTechniqueSlugs] } },
    });
    const techniqueIdBySlug = new Map(techniques.map((t) => [t.techniqueId, t.id]));

    const telemetry = generateTelemetry(sessionId, session.seed, def, techniqueIdBySlug);

    await this.prisma.$transaction([
      this.prisma.identity.createMany({ data: telemetry.identities }),
      this.prisma.device.createMany({ data: telemetry.devices }),
    ]);

    // Sign-in events and email messages reference identities/devices created above, so they
    // run in a second transaction once those foreign keys exist.
    await this.prisma.$transaction([
      this.prisma.signInEvent.createMany({ data: telemetry.signInEvents }),
      this.prisma.emailMessage.createMany({ data: telemetry.emailMessages }),
    ]);

    if (telemetry.emailAttachments.length > 0 || telemetry.emailUrls.length > 0) {
      await this.prisma.$transaction([
        this.prisma.emailAttachment.createMany({ data: telemetry.emailAttachments }),
        this.prisma.emailUrl.createMany({ data: telemetry.emailUrls }),
      ]);
    }

    this.logger.log(
      `Generated telemetry for session ${sessionId}: ${telemetry.identities.length} identities, ` +
        `${telemetry.devices.length} devices, ${telemetry.signInEvents.length} sign-ins, ` +
        `${telemetry.emailMessages.length} emails.`,
    );
  }
}
