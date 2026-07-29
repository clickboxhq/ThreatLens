import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeScore, ScoringInput } from './scorer';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';
import type { IncidentVerdict } from '@prisma/client';

interface ScoringRubric {
  required_techniques: string[];
  required_verdict: string;
  containment_expectations: unknown[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** §12.4: fetches the facts computeScore needs, scores the session, and persists it. */
  async scoreSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.score.findUnique({ where: { sessionId } });
    if (existing) {
      this.logger.log(`Session ${sessionId} already scored; skipping (idempotent).`);
      return;
    }

    const session = await this.prisma.investigationSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scenarioVersion: true },
    });
    const def = session.scenarioVersion.groundTruthDefinition as unknown as GroundTruthDefinition & {
      scoring_rubric: ScoringRubric;
    };
    const rubric = def.scoring_rubric;

    const closedIncidents = await this.prisma.incident.findMany({
      where: { sessionId, status: 'closed' },
      include: {
        techniqueLinks: { include: { mitreTechnique: true } },
        alertLinks: true,
        evidenceCollection: true,
      },
    });

    const taggedTechniqueIds = [
      ...new Set(closedIncidents.flatMap((i) => i.techniqueLinks.map((t) => t.mitreTechnique.techniqueId))),
    ];
    const submittedVerdicts = closedIncidents.map((i) => i.verdict).filter((v): v is IncidentVerdict => Boolean(v));

    const [groundTruthEmails, groundTruthSignIns] = await Promise.all([
      this.prisma.emailMessage.count({ where: { sessionId, isGroundTruthEvidence: true } }),
      this.prisma.signInEvent.count({ where: { sessionId, isGroundTruthEvidence: true } }),
    ]);
    const totalGroundTruthEvidenceCount = groundTruthEmails + groundTruthSignIns;

    const pinnedEvidence = closedIncidents.flatMap((i) => i.evidenceCollection);
    const pinnedTotalEvidenceCount = pinnedEvidence.length;
    const pinnedGroundTruthEvidenceCount = await this.countGroundTruthAmong(pinnedEvidence);

    const falsePositiveAlerts = await this.prisma.alert.findMany({
      where: { sessionId, isFalsePositiveByDesign: true },
      include: { evidenceRefs: true },
    });
    const escalatedAlertIds = new Set(closedIncidents.flatMap((i) => i.alertLinks.map((l) => l.alertId)));
    const pinnedEventIds = new Set(pinnedEvidence.map((e) => e.eventId));

    let falsePositiveCorrectlyHandledCount = 0;
    let falsePositiveMishandledCount = 0;
    for (const alert of falsePositiveAlerts) {
      const wasEscalatedOrPinned =
        escalatedAlertIds.has(alert.id) || alert.evidenceRefs.some((ref) => pinnedEventIds.has(ref.eventId));
      const wasCorrectlyDismissed = alert.status === 'dismissed' && Boolean(alert.dismissalReason);
      if (wasEscalatedOrPinned) falsePositiveMishandledCount += 1;
      else if (wasCorrectlyDismissed) falsePositiveCorrectlyHandledCount += 1;
    }

    const timeToResolutionSeconds = session.submittedAt
      ? Math.round((session.submittedAt.getTime() - session.startedAt.getTime()) / 1000)
      : 0;

    const input: ScoringInput = {
      requiredTechniqueIds: rubric.required_techniques,
      taggedTechniqueIds,
      totalGroundTruthEvidenceCount,
      pinnedGroundTruthEvidenceCount,
      pinnedTotalEvidenceCount,
      falsePositiveByDesignAlertCount: falsePositiveAlerts.length,
      falsePositiveCorrectlyHandledCount,
      falsePositiveMishandledCount,
      containmentExpectationCount: rubric.containment_expectations.length,
      containmentMetCount: 0,
      requiredVerdict: rubric.required_verdict,
      submittedVerdicts,
      hintPenaltyPercent: 0,
      timeToResolutionSeconds,
    };

    const breakdown = computeScore(input);

    await this.prisma.$transaction([
      this.prisma.score.create({
        data: {
          sessionId,
          overallPercent: breakdown.overallPercent,
          techniqueAccuracyPercent: breakdown.techniqueAccuracyPercent,
          evidencePrecisionPercent: breakdown.evidencePrecisionPercent,
          evidenceRecallPercent: breakdown.evidenceRecallPercent,
          falsePositiveCount: breakdown.falsePositiveCount,
          hintPenaltyPercent: input.hintPenaltyPercent,
          timeToResolutionSeconds,
          verdictCorrect: breakdown.verdictCorrect,
          rubricBreakdown: breakdown as unknown as object,
        },
      }),
      this.prisma.investigationSession.update({ where: { id: sessionId }, data: { status: 'scored' } }),
    ]);

    this.logger.log(`Scored session ${sessionId}: ${breakdown.overallPercent}%`);
  }

  private async countGroundTruthAmong(pinnedEvidence: { eventTable: string; eventId: string }[]): Promise<number> {
    const emailIds = pinnedEvidence.filter((e) => e.eventTable === 'email_messages').map((e) => e.eventId);
    const signInIds = pinnedEvidence.filter((e) => e.eventTable === 'sign_in_events').map((e) => e.eventId);

    const [groundTruthEmailCount, groundTruthSignInCount] = await Promise.all([
      emailIds.length > 0
        ? this.prisma.emailMessage.count({ where: { id: { in: emailIds }, isGroundTruthEvidence: true } })
        : Promise.resolve(0),
      signInIds.length > 0
        ? this.prisma.signInEvent.count({ where: { id: { in: signInIds }, isGroundTruthEvidence: true } })
        : Promise.resolve(0),
    ]);

    return groundTruthEmailCount + groundTruthSignInCount;
  }
}
