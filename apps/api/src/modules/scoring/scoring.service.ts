import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeScore, ScoringInput } from './scorer';
import { summarizeEvidenceRef } from '../../common/dto/evidence-summary';
import { CertificatesService } from '../learning/certificates.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { GroundTruthDefinition } from '../telemetry-generator/generator';
import type { IncidentVerdict } from '@prisma/client';
import {
  RESPONSE_ACTION_TYPES,
  type ResponseActionType,
} from '../investigation/dto/incident.dto';

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

/** §12.1's containment_expectations entry, narrowed to what is scored today. */
export interface ContainmentExpectation {
  action: ResponseActionType;
  /** A population ref — `victim_identity_1`, `patient_zero_device` — resolved via narrative_ref. */
  target: string;
  by_relative_time?: string;
  weight?: number;
}

interface ScoringRubric {
  required_techniques: string[];
  required_verdict: string;
  containment_expectations: ContainmentExpectation[];
}

export interface TriageAlertFact {
  id: string;
  title: string;
  status: string;
  dismissalReason: string | null;
  isFalsePositiveByDesign: boolean;
  evidenceEventIds: string[];
}

export interface TriageOutcome {
  alertCount: number;
  realAlertsEscalated: number;
  realAlertsDismissed: number;
  baitAlertsDismissed: number;
  baitAlertsMishandled: number;
  /** The debrief's three "what went wrong" lists, plus the two that went right. */
  escalatedCorrectly: string[];
  dismissedCorrectly: string[];
  escalatedBait: string[];
  dismissedReal: string[];
  untouched: string[];
}

/**
 * §8.6 / §12.4 component 3: sort every alert the session raised into the decision the
 * student made about it. Pure and exported for direct unit testing.
 *
 * "Escalated" means linked to a closed incident. "Dismissed" requires the reason the DTO
 * already insists on. Pinning any of a bait alert's evidence counts as sweeping it in, the
 * same as escalating it — the debrief says which. A real alert that was only pinned, never
 * escalated, is untouched here; the evidence score has already credited the pin.
 */
export function classifyTriage(
  alerts: TriageAlertFact[],
  escalatedAlertIds: Set<string>,
  pinnedEventIds: Set<string>,
): TriageOutcome {
  const out: TriageOutcome = {
    alertCount: alerts.length,
    realAlertsEscalated: 0,
    realAlertsDismissed: 0,
    baitAlertsDismissed: 0,
    baitAlertsMishandled: 0,
    escalatedCorrectly: [],
    dismissedCorrectly: [],
    escalatedBait: [],
    dismissedReal: [],
    untouched: [],
  };
  for (const alert of alerts) {
    const escalated = escalatedAlertIds.has(alert.id);
    const pinned = alert.evidenceEventIds.some((id) => pinnedEventIds.has(id));
    const dismissed =
      alert.status === 'dismissed' && Boolean(alert.dismissalReason);

    if (alert.isFalsePositiveByDesign) {
      if (escalated || pinned) {
        out.baitAlertsMishandled += 1;
        out.escalatedBait.push(alert.title);
      } else if (dismissed) {
        out.baitAlertsDismissed += 1;
        out.dismissedCorrectly.push(alert.title);
      } else {
        out.untouched.push(alert.title);
      }
    } else if (escalated) {
      out.realAlertsEscalated += 1;
      out.escalatedCorrectly.push(alert.title);
    } else if (dismissed) {
      out.realAlertsDismissed += 1;
      out.dismissedReal.push(alert.title);
    } else {
      out.untouched.push(alert.title);
    }
  }
  return out;
}

export interface ContainmentTarget {
  id: string;
  label: string;
}

export interface ContainmentOutcome {
  expectationCount: number;
  metCount: number;
  unnecessaryCount: number;
  expected: { action: string; targetLabel: string }[];
  met: { action: string; targetLabel: string }[];
  missed: { action: string; targetLabel: string }[];
  unnecessary: { action: string; targetLabel: string }[];
}

/**
 * §12.4 component 4. An expectation is met when the named action was taken against the
 * entity its ref resolves to. Anything taken that matches no expectation is "unnecessary":
 * scored as over-containment when the rubric expected nothing, otherwise only reported. An
 * expectation whose ref does not resolve (an authoring error the validator should have
 * caught) is counted as expected-and-missed rather than silently dropped, so it shows up in a
 * debrief instead of quietly inflating the score. Pure and exported for direct unit testing.
 */
export function evaluateContainment(
  expectations: ContainmentExpectation[],
  actionsTaken: { actionType: string; targetId: string }[],
  targetByRef: Map<string, ContainmentTarget>,
  labelById: Map<string, string>,
): ContainmentOutcome {
  const out: ContainmentOutcome = {
    expectationCount: expectations.length,
    metCount: 0,
    unnecessaryCount: 0,
    expected: [],
    met: [],
    missed: [],
    unnecessary: [],
  };
  const satisfiedBy = new Set<number>();
  expectations.forEach((exp) => {
    const target = targetByRef.get(exp.target);
    const entry = {
      action: exp.action,
      targetLabel: target?.label ?? exp.target,
    };
    out.expected.push(entry);
    const hit = target
      ? actionsTaken.findIndex(
          (a, j) =>
            !satisfiedBy.has(j) &&
            a.actionType === exp.action &&
            a.targetId === target.id,
        )
      : -1;
    if (hit >= 0) {
      satisfiedBy.add(hit);
      out.metCount += 1;
      out.met.push(entry);
    } else {
      out.missed.push(entry);
    }
  });
  actionsTaken.forEach((a, j) => {
    if (satisfiedBy.has(j)) return;
    out.unnecessaryCount += 1;
    out.unnecessary.push({
      action: a.actionType,
      targetLabel: labelById.get(a.targetId) ?? 'an unspecified target',
    });
  });
  return out;
}

/**
 * The generator's correlation grouping, re-read from Alert.relatedAlertId once the session is
 * scored — the first moment it is safe to show. Groups of one are not a correlation and are
 * left out. Pure and exported for direct unit testing.
 */
export function correlationGroups(
  alerts: { id: string; title: string; relatedAlertId: string | null }[],
): { alertTitles: string[] }[] {
  const parent = new Map(alerts.map((a) => [a.id, a.id]));
  const find = (id: string): string => {
    let cur = id;
    while (parent.get(cur) !== cur) cur = parent.get(cur)!;
    return cur;
  };
  for (const a of alerts) {
    if (a.relatedAlertId && parent.has(a.relatedAlertId)) {
      parent.set(find(a.id), find(a.relatedAlertId));
    }
  }
  const byRoot = new Map<string, string[]>();
  for (const a of alerts) {
    const root = find(a.id);
    const list = byRoot.get(root) ?? [];
    list.push(a.title);
    byRoot.set(root, list);
  }
  return [...byRoot.values()]
    .filter((titles) => titles.length > 1)
    .map((alertTitles) => ({ alertTitles }));
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificatesService: CertificatesService,
    private readonly achievementsService: AchievementsService,
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
      groundTruthDirectoryAudit,
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
      // The directory audit trail was missing from all three of these lists, so a scenario's
      // group change, inbox rule or MFA registration — the finding itself, in identity cases —
      // could be neither found among what was pinned nor named as missed.
      this.prisma.directoryAuditEvent.count({
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
      groundTruthHttp +
      groundTruthDirectoryAudit;

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
    const groundTruthAmongCurated =
      await this.findGroundTruthAmong(curatedEvidence);
    const pinnedGroundTruthEvidenceCount = groundTruthAmongCurated.size;

    const alerts = await this.prisma.alert.findMany({
      where: { sessionId },
      include: { evidenceRefs: true },
    });
    const escalatedAlertIds = new Set(
      closedIncidents.flatMap((i) => i.alertLinks.map((l) => l.alertId)),
    );
    const pinnedEventIds = new Set(curatedEvidence.map((e) => e.eventId));

    const triage = classifyTriage(
      alerts.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        dismissalReason: a.dismissalReason,
        isFalsePositiveByDesign: a.isFalsePositiveByDesign,
        evidenceEventIds: a.evidenceRefs.map((r) => r.eventId),
      })),
      escalatedAlertIds,
      pinnedEventIds,
    );

    // Containment: resolve each expectation's population ref to the row the generator made
    // from it, then look for a matching action. isolate_device is recorded with the real
    // device id by the device portal; the other five arrive through logResponseAction, which
    // records the target the student picked (or the incident, for a client that sent none).
    const [sessionIdentities, sessionDevices, responseActions] =
      await Promise.all([
        this.prisma.identity.findMany({
          where: { sessionId },
          select: { id: true, displayName: true, narrativeRef: true },
        }),
        this.prisma.device.findMany({
          where: { sessionId },
          select: { id: true, hostname: true, narrativeRef: true },
        }),
        this.prisma.investigationAction.findMany({
          where: { sessionId, actionType: { in: [...RESPONSE_ACTION_TYPES] } },
          select: { actionType: true, targetId: true },
        }),
      ]);
    const targetByRef = new Map<string, ContainmentTarget>();
    const labelById = new Map<string, string>();
    for (const i of sessionIdentities) {
      labelById.set(i.id, i.displayName);
      if (i.narrativeRef)
        targetByRef.set(i.narrativeRef, { id: i.id, label: i.displayName });
    }
    for (const d of sessionDevices) {
      labelById.set(d.id, d.hostname);
      if (d.narrativeRef)
        targetByRef.set(d.narrativeRef, { id: d.id, label: d.hostname });
    }
    const containment = evaluateContainment(
      rubric.containment_expectations ?? [],
      responseActions,
      targetByRef,
      labelById,
    );

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
      alertCount: triage.alertCount,
      realAlertsEscalated: triage.realAlertsEscalated,
      realAlertsDismissed: triage.realAlertsDismissed,
      baitAlertsDismissed: triage.baitAlertsDismissed,
      baitAlertsMishandled: triage.baitAlertsMishandled,
      containmentExpectationCount: containment.expectationCount,
      containmentMetCount: containment.metCount,
      unnecessaryContainmentCount: containment.unnecessaryCount,
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

    // The other half of the debrief: what was wrong, not just what was absent.
    //
    // Everything above answers "what did you miss" — missed techniques, missed evidence — so a
    // Student who missed nothing but over-tagged saw an empty debrief under a mark well short
    // of full. That is the common case: tagging every plausible technique scores 100% recall
    // and poor precision, and nothing on the results screen said which tags were wrong, which
    // pinned items were not evidence, or what the verdict should have been. Three of the five
    // rubric components could lose marks silently.
    const incorrectTechniqueSlugs = taggedTechniqueIds.filter(
      (t) => !rubric.required_techniques.includes(t),
    );
    const incorrectTechniques = incorrectTechniqueSlugs.length
      ? await this.prisma.mitreTechnique.findMany({
          where: { techniqueId: { in: incorrectTechniqueSlugs } },
        })
      : [];

    const unnecessaryEvidenceRefs = curatedEvidence.filter(
      (e) => !groundTruthAmongCurated.has(e.eventId),
    );
    const unnecessaryEvidence = await Promise.all(
      unnecessaryEvidenceRefs.map((ref) =>
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
      // Tagged, but not part of this incident.
      incorrectTechniques: incorrectTechniques.map((t) => ({
        id: t.id,
        techniqueId: t.techniqueId,
        name: t.name,
      })),
      // Collected, but not evidence of anything — the noise the scenario planted.
      unnecessaryEvidence: unnecessaryEvidence.map((e) => ({
        eventTable: e.eventTable,
        summary: e.summary,
      })),
      // Safe to state once the session is submitted and read-only, and it is the single thing
      // a Student most needs told when this component scores zero.
      verdict: {
        submitted: submittedVerdicts,
        required: rubric.required_verdict,
        correct: breakdown.verdictCorrect,
      },
      // The two components that used to lose marks silently. Each names the alerts or actions
      // behind its number, in the same spirit as the evidence and technique lists above.
      triage: {
        escalatedCorrectly: triage.escalatedCorrectly,
        dismissedCorrectly: triage.dismissedCorrectly,
        escalatedBait: triage.escalatedBait,
        dismissedReal: triage.dismissedReal,
        untouched: triage.untouched,
      },
      response: {
        expected: containment.expected,
        met: containment.met,
        missed: containment.missed,
        unnecessary: containment.unnecessary,
      },
      // The generator's own grouping of the alerts — which ones were one chain — revealed here
      // and nowhere earlier, so the student can set their triage against it.
      correlation: {
        groups: correlationGroups(
          alerts.map((a) => ({
            id: a.id,
            title: a.title,
            relatedAlertId: a.relatedAlertId,
          })),
        ),
      },
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
  //
  // These return the matching ids rather than a count. The count is one `.length` away, and
  // having the ids is what lets the debrief name the items a Student pinned that were not
  // evidence — the precision half of the score, which until now was a bare percentage with
  // nothing behind it. A third parallel copy of this table list, just to get the same rows
  // back as ids, is exactly the maintenance trap the note above is warning about.
  private readonly groundTruthIdFinders: Record<
    string,
    (ids: string[]) => Promise<{ id: string }[]>
  > = {
    email_messages: (ids) =>
      this.prisma.emailMessage.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    sign_in_events: (ids) =>
      this.prisma.signInEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    process_events: (ids) =>
      this.prisma.processEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    file_events: (ids) =>
      this.prisma.fileEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    network_events: (ids) =>
      this.prisma.networkEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    cloud_events: (ids) =>
      this.prisma.cloudEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    http_requests: (ids) =>
      this.prisma.httpRequest.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
    directory_audit_events: (ids) =>
      this.prisma.directoryAuditEvent.findMany({
        where: { id: { in: ids }, isGroundTruthEvidence: true },
        select: { id: true },
      }),
  };

  /** Which of the curated items are real evidence. Precision is this set's size over the whole. */
  private async findGroundTruthAmong(
    pinnedEvidence: { eventTable: string; eventId: string }[],
  ): Promise<Set<string>> {
    const idsByTable = new Map<string, string[]>();
    for (const item of pinnedEvidence) {
      const list = idsByTable.get(item.eventTable) ?? [];
      list.push(item.eventId);
      idsByTable.set(item.eventTable, list);
    }

    const found = await Promise.all(
      [...idsByTable.entries()].map(([table, ids]) => {
        const find = this.groundTruthIdFinders[table];
        return find ? find(ids) : Promise.resolve([]);
      }),
    );

    return new Set(found.flat().map((row) => row.id));
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
    directory_audit_events: async (sessionId, excludeIds) =>
      (
        await this.prisma.directoryAuditEvent.findMany({
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
