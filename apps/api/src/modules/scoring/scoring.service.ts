import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeScore, ScoringInput } from './scorer';
import { summarizeEvidenceRef } from '../../common/dto/evidence-summary';
import { CertificatesService } from '../learning/certificates.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CareerProgressionService } from '../career-progression/career-progression.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';
import type { IncidentVerdict } from '@prisma/client';

// Pure and exported for direct unit testing (same rationale as computeScore in scorer.ts):
// an item pinned as evidence AND added to the Timeline must count once, not twice, toward
// either side of the evidence precision/recall ratio.
export function dedupeByEvent<
  T extends { eventTable: string; eventId: string },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = `${item.eventTable} ${item.eventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

interface ScoringRubric {
  required_techniques: string[];
  required_verdict: string;
  containment_expectations: unknown[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificatesService: CertificatesService,
    private readonly achievementsService: AchievementsService,
    private readonly careerProgressionService: CareerProgressionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** §12.4: fetches the facts computeScore needs, scores the session, and persists it. */
  async scoreSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.score.findUnique({
      where: { sessionId },
    });
    if (existing) {
      this.logger.log(
        `Session ${sessionId} already scored; skipping (idempotent).`,
      );
      return;
    }

    const session = await this.prisma.investigationSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scenarioVersion: true, scenario: true },
    });
    const def = session.scenarioVersion
      .groundTruthDefinition as unknown as GroundTruthDefinition & {
      scoring_rubric: ScoringRubric;
    };
    const rubric = def.scoring_rubric;

    const closedIncidents = await this.prisma.incident.findMany({
      where: { sessionId, status: 'closed' },
      include: {
        techniqueLinks: { include: { mitreTechnique: true } },
        alertLinks: true,
        evidenceCollection: true,
        timelineItems: true,
      },
    });

    const taggedTechniqueIds = [
      ...new Set(
        closedIncidents.flatMap((i) =>
          i.techniqueLinks.map((t) => t.mitreTechnique.techniqueId),
        ),
      ),
    ];
    const submittedVerdicts = closedIncidents
      .map((i) => i.verdict)
      .filter((v): v is IncidentVerdict => Boolean(v));

    const [
      groundTruthEmails,
      groundTruthSignIns,
      groundTruthProcesses,
      groundTruthFiles,
      groundTruthNetwork,
      groundTruthCloud,
      groundTruthHttp,
    ] = await Promise.all([
      this.prisma.emailMessage.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.signInEvent.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.processEvent.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.fileEvent.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.networkEvent.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.cloudEvent.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
      this.prisma.httpRequest.count({
        where: { sessionId, isGroundTruthEvidence: true },
      }),
    ]);
    const totalGroundTruthEvidenceCount =
      groundTruthEmails +
      groundTruthSignIns +
      groundTruthProcesses +
      groundTruthFiles +
      groundTruthNetwork +
      groundTruthCloud +
      groundTruthHttp;

    // §2.9: "that curated set [the Timeline] is itself part of what the Scoring Engine
    // evaluates (did they include the right events; did they include noise)" — folded into
    // the same evidence precision/recall pool Evidence Collection already feeds, rather than
    // a separate rubric component, since "right events vs noise" is exactly what that
    // component already measures. Deduped by (eventTable, eventId): an item pinned AND
    // timeline-added must count once, not twice, toward either side of the ratio.
    const pinnedEvidence = closedIncidents.flatMap((i) => i.evidenceCollection);
    const timelineItems = closedIncidents.flatMap((i) => i.timelineItems);
    const curatedEvidence = dedupeByEvent([
      ...pinnedEvidence,
      ...timelineItems,
    ]);
    const pinnedTotalEvidenceCount = curatedEvidence.length;
    const pinnedGroundTruthEvidenceCount =
      await this.countGroundTruthAmong(curatedEvidence);

    const falsePositiveAlerts = await this.prisma.alert.findMany({
      where: { sessionId, isFalsePositiveByDesign: true },
      include: { evidenceRefs: true },
    });
    const escalatedAlertIds = new Set(
      closedIncidents.flatMap((i) => i.alertLinks.map((l) => l.alertId)),
    );
    const pinnedEventIds = new Set(curatedEvidence.map((e) => e.eventId));

    let falsePositiveCorrectlyHandledCount = 0;
    let falsePositiveMishandledCount = 0;
    for (const alert of falsePositiveAlerts) {
      const wasEscalatedOrPinned =
        escalatedAlertIds.has(alert.id) ||
        alert.evidenceRefs.some((ref) => pinnedEventIds.has(ref.eventId));
      const wasCorrectlyDismissed =
        alert.status === 'dismissed' && Boolean(alert.dismissalReason);
      if (wasEscalatedOrPinned) falsePositiveMishandledCount += 1;
      else if (wasCorrectlyDismissed) falsePositiveCorrectlyHandledCount += 1;
    }

    const timeToResolutionSeconds = session.submittedAt
      ? Math.round(
          (session.submittedAt.getTime() - session.startedAt.getTime()) / 1000,
        )
      : 0;

    // §12.5: sum of every unlocked hint's authored unlock_cost_percent for this session.
    const hintUnlocks = await this.prisma.hintUnlock.findMany({
      where: { sessionId },
    });
    const hintPenaltyPercent = hintUnlocks.reduce(
      (sum, u) => sum + Number(u.unlockCostPercent),
      0,
    );

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
      hintPenaltyPercent,
      timeToResolutionSeconds,
    };

    const breakdown = computeScore(input);

    // §2.12: "a Student needs to see specifically which evidence they missed and which
    // technique tags were wrong to actually learn from an attempt, not just know they
    // scored 61%." Computed once here (not recomputed on every results-screen read) and
    // stored alongside the rubric breakdown, through the same Student-safe DTOs every other
    // evidence display uses (§18.3) — never raw ground-truth rows.
    const missedTechniqueSlugs = rubric.required_techniques.filter(
      (t) => !taggedTechniqueIds.includes(t),
    );
    const missedTechniques = missedTechniqueSlugs.length
      ? await this.prisma.mitreTechnique.findMany({
          where: { techniqueId: { in: missedTechniqueSlugs } },
        })
      : [];

    const missedEvidenceRefs = await this.findMissedGroundTruthEvidence(
      sessionId,
      pinnedEventIds,
    );
    const missedEvidence = await Promise.all(
      missedEvidenceRefs.map((ref) =>
        summarizeEvidenceRef(this.prisma, ref.eventTable, ref.eventId),
      ),
    );

    const rubricBreakdown = {
      ...breakdown,
      missedTechniques: missedTechniques.map((t) => ({
        id: t.id,
        techniqueId: t.techniqueId,
        name: t.name,
      })),
      missedEvidence: missedEvidence.map((e) => ({
        eventTable: e.eventTable,
        summary: e.summary,
      })),
    };

    await this.prisma.$transaction([
      this.prisma.score.upsert({
        where: { sessionId },
        // §16.13 instructor reopen (§2.15) sends a session back to `active`, so a
        // resubmission re-scores in place rather than colliding with `scores.session_id`'s
        // UNIQUE constraint from the first scoring run.
        create: {
          sessionId,
          overallPercent: breakdown.overallPercent,
          techniqueAccuracyPercent: breakdown.techniqueAccuracyPercent,
          evidencePrecisionPercent: breakdown.evidencePrecisionPercent,
          evidenceRecallPercent: breakdown.evidenceRecallPercent,
          falsePositiveCount: breakdown.falsePositiveCount,
          hintPenaltyPercent: input.hintPenaltyPercent,
          timeToResolutionSeconds,
          verdictCorrect: breakdown.verdictCorrect,
          rubricBreakdown: rubricBreakdown as unknown as object,
        },
        update: {
          overallPercent: breakdown.overallPercent,
          techniqueAccuracyPercent: breakdown.techniqueAccuracyPercent,
          evidencePrecisionPercent: breakdown.evidencePrecisionPercent,
          evidenceRecallPercent: breakdown.evidenceRecallPercent,
          falsePositiveCount: breakdown.falsePositiveCount,
          hintPenaltyPercent: input.hintPenaltyPercent,
          timeToResolutionSeconds,
          verdictCorrect: breakdown.verdictCorrect,
          rubricBreakdown: rubricBreakdown as unknown as object,
          scoredAt: new Date(),
        },
      }),
      this.prisma.investigationSession.update({
        where: { id: sessionId },
        data: { status: 'scored' },
      }),
    ]);

    // §13.4: after every scoring run, not just the first — a retry that finally clears a
    // learning path's threshold should issue the certificate then, not only on the attempt
    // that happened to be the one that pushed a scenario's best score over the bar.
    await this.certificatesService.checkAndIssueForScenario(
      session.userId,
      session.scenarioId,
    );
    await this.achievementsService.checkAndIssue(session.userId);
    await this.careerProgressionService.checkAndPromote(session.userId);
    await this.notificationsService.create({
      userId: session.userId,
      category: 'score_available',
      title: 'Investigation scored',
      body: `${session.scenario.title} scored ${breakdown.overallPercent}%.`,
      link: `/app/cases/${sessionId}`,
    });

    this.logger.log(
      `Scored session ${sessionId}: ${breakdown.overallPercent}%`,
    );
  }

  // §6.12: every telemetry event table an evidence_collection row can point at (§6.17).
  // Adding a new investigation surface (e.g. Device Portal's process/file/network tables)
  // means adding its table name and Prisma model here, or pinned evidence from it silently
  // never counts toward recall/precision — Device Portal's addition caught exactly this gap.
  private readonly groundTruthCounters: Record<
    string,
    (ids: string[]) => Promise<number>
  > = {
    email_messages: (ids) =>
      this.prisma.emailMessage.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    sign_in_events: (ids) =>
      this.prisma.signInEvent.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    process_events: (ids) =>
      this.prisma.processEvent.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    file_events: (ids) =>
      this.prisma.fileEvent.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    network_events: (ids) =>
      this.prisma.networkEvent.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    cloud_events: (ids) =>
      this.prisma.cloudEvent.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
    http_requests: (ids) =>
      this.prisma.httpRequest.count({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
      }),
  };

  private async countGroundTruthAmong(
    pinnedEvidence: { eventTable: string; eventId: string }[],
  ): Promise<number> {
    const idsByTable = new Map<string, string[]>();
    for (const item of pinnedEvidence) {
      const list = idsByTable.get(item.eventTable) ?? [];
      list.push(item.eventId);
      idsByTable.set(item.eventTable, list);
    }

    const counts = await Promise.all(
      [...idsByTable.entries()].map(([table, ids]) => {
        const counter = this.groundTruthCounters[table];
        return counter ? counter(ids) : Promise.resolve(0);
      }),
    );

    return counts.reduce((sum, count) => sum + count, 0);
  }

  // Mirrors groundTruthCounters above — same "add a new table here too" maintenance note
  // applies, since a missed table would silently vanish from the debrief instead of the
  // recall score.
  private readonly missedEvidenceFinders: Record<
    string,
    (sessionId: string, excludeIds: string[]) => Promise<string[]>
  > = {
    email_messages: async (sessionId, excludeIds) =>
      (
        await this.prisma.emailMessage.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    sign_in_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.signInEvent.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    process_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.processEvent.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    file_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.fileEvent.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    network_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.networkEvent.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    cloud_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.cloudEvent.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
    http_requests: async (sessionId, excludeIds) =>
      (
        await this.prisma.httpRequest.findMany({
          where: {
            sessionId,
            isGroundTruthEvidence: true,
            id: { notIn: excludeIds },
          },
          select: { id: true },
        })
      ).map((r) => r.id),
  };

  private async findMissedGroundTruthEvidence(
    sessionId: string,
    pinnedEventIds: Set<string>,
  ): Promise<{ eventTable: string; eventId: string }[]> {
    const excludeIds = [...pinnedEventIds];
    const results = await Promise.all(
      Object.entries(this.missedEvidenceFinders).map(
        async ([eventTable, find]) => {
          const ids = await find(sessionId, excludeIds);
          return ids.map((eventId) => ({ eventTable, eventId }));
        },
      ),
    );
    return results.flat();
  }
}
