import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { SessionAccessService } from '../session-core/session-access.service';
import { InvestigationActionsService } from '../session-core/investigation-actions.service';
import {
  TELEMETRY_GENERATION_QUEUE,
  SCORING_QUEUE,
} from '../../common/queue/queue.module';
import { computeSkillRadar, computeTechniqueMastery } from './skill-radar';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { TelemetryGenerationJobData } from '../telemetry-generator/telemetry-generator.processor';
import type { ScoringJobData } from '../scoring/scoring.types';
import type { SessionTechniqueOutcome } from './skill-radar';

const SESSION_TTL_HOURS = 6;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly investigationActions: InvestigationActionsService,
    @InjectQueue(TELEMETRY_GENERATION_QUEUE)
    private readonly telemetryQueue: Queue<TelemetryGenerationJobData>,
    @InjectQueue(SCORING_QUEUE)
    private readonly scoringQueue: Queue<ScoringJobData>,
  ) {}

  async createSession(
    user: AuthenticatedUser,
    scenarioId: string,
    cohortAssignmentId?: string,
  ) {
    // §15.1: "email verification required before a self-serve account can start a scored
    // session." Every session in this app feeds the Scoring Engine and leaderboard/certificate
    // eligibility (there's no separate free-tier/unscored session type), so this is the one
    // gating point. Checked fresh against the DB, not a JWT claim, so verifying takes effect
    // immediately without requiring the Student to log in again.
    const requester = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true },
    });
    if (!requester?.emailVerifiedAt) {
      throw new AppException(
        403,
        'EMAIL_VERIFICATION_REQUIRED',
        'Please verify your email address before starting a scenario.',
      );
    }

    const scenario = await this.prisma.attackScenario.findUnique({
      where: { id: scenarioId },
    });
    if (
      !scenario ||
      scenario.status !== 'published' ||
      !scenario.currentVersionId
    ) {
      throw new AppException(
        404,
        'SCENARIO_NOT_FOUND',
        'Scenario not found or not published.',
      );
    }

    if (cohortAssignmentId) {
      await this.assertValidAssignmentAttempt(
        user,
        cohortAssignmentId,
        scenario.id,
      );
    }

    const seed = randomBytes(6).readUIntBE(0, 6);

    const session = await this.prisma.investigationSession.create({
      data: {
        userId: user.id,
        scenarioId: scenario.id,
        scenarioVersionId: scenario.currentVersionId,
        cohortAssignmentId,
        status: 'active',
        seed: BigInt(seed),
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    await this.telemetryQueue.add(
      'generate',
      { sessionId: session.id },
      { jobId: `telemetry-generation-${session.id}` },
    );

    return this.toSessionDto(session.id);
  }

  async getSession(sessionId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    return this.toSessionDto(sessionId);
  }

  // §2.17/§13.2: a Student's own investigation history — every attempt across every
  // scenario, newest first, so "did I get better" is answerable without re-deriving it
  // from individual session/score lookups.
  async listMine(user: AuthenticatedUser) {
    const sessions = await this.prisma.investigationSession.findMany({
      where: { userId: user.id },
      include: { scenario: true, score: true },
      orderBy: { startedAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      scenarioId: session.scenarioId,
      scenarioTitle: session.scenario.title,
      scenarioCategory: session.scenario.category,
      status: session.status,
      overallPercent: session.score?.overallPercent ?? null,
      verdictCorrect: session.score?.verdictCorrect ?? null,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
    }));
  }

  // §2.17/§13.2: aggregates every scored session's required-vs-tagged techniques into a
  // per-tactic proficiency rollup. Mirrors scoring.service.ts's own required/tagged
  // computation (rubric JSON + closed-incident IncidentTechnique rows) rather than reading
  // back through Score.rubricBreakdown, since that field never captured a tactic or a hit list.
  async getSkillRadar(user: AuthenticatedUser) {
    const { outcomes, allTechniques } = await this.loadTechniqueOutcomes(user);
    const tacticByTechniqueId = new Map(
      allTechniques.map((t) => [t.techniqueId, t.tactic]),
    );
    return computeSkillRadar(outcomes, tacticByTechniqueId);
  }

  // Same required-vs-tagged aggregation as getSkillRadar, but rolled up per individual
  // technique rather than per tactic — backs the MITRE ATT&CK Explorer's technique table.
  async getTechniqueMastery(user: AuthenticatedUser) {
    const { outcomes, allTechniques } = await this.loadTechniqueOutcomes(user);
    const metaByTechniqueId = new Map(
      allTechniques.map((t) => [t.techniqueId, t]),
    );
    return computeTechniqueMastery(outcomes, metaByTechniqueId);
  }

  private async loadTechniqueOutcomes(user: AuthenticatedUser): Promise<{
    outcomes: SessionTechniqueOutcome[];
    allTechniques: { techniqueId: string; name: string; tactic: string }[];
  }> {
    const scoredSessions = await this.prisma.investigationSession.findMany({
      where: { userId: user.id, status: 'scored' },
      include: { scenarioVersion: true },
    });

    const sessionIds = scoredSessions.map((s) => s.id);
    const closedIncidents = sessionIds.length
      ? await this.prisma.incident.findMany({
          where: { sessionId: { in: sessionIds }, status: 'closed' },
          include: { techniqueLinks: { include: { mitreTechnique: true } } },
        })
      : [];

    const taggedBySessionId = new Map<string, Set<string>>();
    for (const incident of closedIncidents) {
      const set =
        taggedBySessionId.get(incident.sessionId) ?? new Set<string>();
      for (const link of incident.techniqueLinks)
        set.add(link.mitreTechnique.techniqueId);
      taggedBySessionId.set(incident.sessionId, set);
    }

    const outcomes: SessionTechniqueOutcome[] = scoredSessions.map(
      (session) => {
        const def = session.scenarioVersion
          .groundTruthDefinition as unknown as {
          scoring_rubric: { required_techniques: string[] };
        };
        return {
          requiredTechniqueIds: def.scoring_rubric.required_techniques,
          taggedTechniqueIds: [...(taggedBySessionId.get(session.id) ?? [])],
        };
      },
    );

    const allTechniques = await this.prisma.mitreTechnique.findMany({
      select: { techniqueId: true, name: true, tactic: true },
    });

    return { outcomes, allTechniques };
  }

  async submitSession(
    sessionId: string,
    user: AuthenticatedUser,
    incidentIds: string[],
  ) {
    const session = await this.sessionAccess.getOwnedSession(sessionId, user);
    if (session.status !== 'active') {
      throw new AppException(
        409,
        'SESSION_NOT_ACTIVE',
        'This session has already been submitted.',
      );
    }

    const incidents = await this.prisma.incident.findMany({
      where: { id: { in: incidentIds }, sessionId },
    });
    if (incidents.length !== incidentIds.length) {
      throw new AppException(
        400,
        'INVALID_INCIDENT_IDS',
        'One or more incident IDs do not belong to this session.',
      );
    }

    await this.prisma.investigationSession.update({
      where: { id: sessionId },
      data: { status: 'submitted', submittedAt: new Date() },
    });

    await this.investigationActions.record({
      sessionId,
      userId: user.id,
      actionType: 'submit_verdict',
      targetType: 'session',
      targetId: sessionId,
    });

    await this.scoringQueue.add(
      'score',
      { sessionId },
      { jobId: `scoring-${sessionId}` },
    );

    return { scoringStatus: 'queued' };
  }

  async getScore(sessionId: string, user: AuthenticatedUser) {
    await this.sessionAccess.getOwnedSession(sessionId, user);
    const score = await this.prisma.score.findUnique({ where: { sessionId } });
    if (!score) {
      throw new AppException(
        404,
        'NOT_SCORED_YET',
        'This session has not been scored yet.',
      );
    }
    return {
      overallPercent: score.overallPercent,
      techniqueAccuracyPercent: score.techniqueAccuracyPercent,
      evidencePrecisionPercent: score.evidencePrecisionPercent,
      evidenceRecallPercent: score.evidenceRecallPercent,
      falsePositiveCount: score.falsePositiveCount,
      hintPenaltyPercent: score.hintPenaltyPercent,
      timeToResolutionSeconds: score.timeToResolutionSeconds,
      verdictCorrect: score.verdictCorrect,
      rubricBreakdown: score.rubricBreakdown,
      scoredAt: score.scoredAt,
    };
  }

  private async assertValidAssignmentAttempt(
    user: AuthenticatedUser,
    cohortAssignmentId: string,
    scenarioId: string,
  ): Promise<void> {
    const assignment = await this.prisma.cohortScenarioAssignment.findUnique({
      where: { id: cohortAssignmentId },
    });
    if (!assignment || assignment.scenarioId !== scenarioId) {
      throw new AppException(
        400,
        'INVALID_ASSIGNMENT',
        'This assignment does not exist for this scenario.',
      );
    }

    const enrollment = await this.prisma.cohortEnrollment.findUnique({
      where: {
        cohortId_userId: { cohortId: assignment.cohortId, userId: user.id },
      },
    });
    if (!enrollment || enrollment.status !== 'active') {
      throw new AppException(
        403,
        'NOT_ENROLLED',
        'You are not enrolled in this assignment’s cohort.',
      );
    }

    if (assignment.attemptLimit != null) {
      const attempts = await this.prisma.investigationSession.count({
        where: { cohortAssignmentId, userId: user.id },
      });
      if (attempts >= assignment.attemptLimit) {
        throw new AppException(
          409,
          'ATTEMPT_LIMIT_REACHED',
          'You have used all attempts for this assignment.',
        );
      }
    }
  }

  private async toSessionDto(sessionId: string) {
    const session = await this.prisma.investigationSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { scenario: true },
    });
    const alertCount = await this.prisma.alert.count({ where: { sessionId } });
    return {
      id: session.id,
      scenarioId: session.scenarioId,
      // The Student-facing case briefing (§2.2): what they're being asked to look into, so the
      // workspace opens with context rather than a bare log dump. Deliberately only the public
      // catalog fields — the ground truth's own `metadata.narrative_summary` describes what
      // actually happened ("an attacker registers a lookalike domain, impersonates the CFO…")
      // and is the answer key, so it must never reach this DTO (§12.3).
      scenarioTitle: session.scenario.title,
      scenarioSummary: session.scenario.summary,
      scenarioCategory: session.scenario.category,
      scenarioDifficulty: session.scenario.difficulty,
      estimatedMinutes: session.scenario.estimatedMinutes,
      status: session.status,
      // A crude but honest readiness signal for the skeleton's REST-polling fallback
      // (§17.9) — WebSocket push replaces this in the breadth phase (§5.10).
      ready: alertCount > 0,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      expiresAt: session.expiresAt,
      currentScenarioTime: session.currentScenarioTime,
    };
  }
}
