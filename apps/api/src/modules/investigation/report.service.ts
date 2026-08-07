import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { TimelineService } from './timeline.service';
import { AppException } from '../../common/exceptions/app-exception';
import { summarizeEvidenceRef } from '../../common/dto/evidence-summary';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { StudentTimelineItemDto } from './timeline.service';

export interface StudentIncidentReportDto {
  incident: {
    id: string;
    title: string;
    status: string;
    verdict: string | null;
    summary: string | null;
    techniques: { id: string; techniqueId: string; name: string }[];
    createdAt: Date;
    closedAt: Date | null;
  };
  notes: { id: string; body: string; createdAt: Date }[];
  evidence: {
    id: string;
    eventTable: string;
    eventId: string;
    justification: string;
    mitreTechniqueId: string | null;
    pinnedAt: Date;
    summary: string;
  }[];
  timeline: StudentTimelineItemDto[];
  // Reflects the whole session's scoring, not just this incident — included because a report
  // read right after closing the incident that made the session's score final is exactly the
  // moment this is most useful, not because scoring is otherwise part of §2.14's "final report"
  // artifact (Notes + Evidence Collection + Timeline + Verdict).
  score: { overallPercent: number; verdictCorrect: boolean; scoredAt: Date } | null;
}

// §2.14/§2.19: "the 'final report' artifact assembled from Notes + Evidence Collection +
// Timeline + Verdict, rendered as a structured document." Deliberately a read-only assembly of
// already-frozen data rather than a persisted snapshot — §2.3's immutability guard (this
// module's EvidenceNotesService/TimelineService both reject writes once an incident is closed)
// is what makes re-assembling it live safe: a closed incident's inputs cannot drift.
@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
    private readonly timelineService: TimelineService,
  ) {}

  async getReport(sessionId: string, incidentId: string, user: AuthenticatedUser): Promise<StudentIncidentReportDto> {
    await this.sessionAccess.getOwnedSession(sessionId, user);

    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, sessionId },
      include: { techniqueLinks: { include: { mitreTechnique: true } } },
    });
    if (!incident) throw new AppException(404, 'NOT_FOUND', 'Incident not found.');
    if (incident.status !== 'closed') {
      throw new AppException(409, 'INCIDENT_NOT_CLOSED', 'A final report is only available once this incident is closed.');
    }

    const [notes, evidence, timeline, score] = await Promise.all([
      this.prisma.analystNote.findMany({ where: { incidentId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.evidenceCollection.findMany({ where: { incidentId }, orderBy: { pinnedAt: 'asc' } }),
      this.timelineService.getTimeline(sessionId, incidentId, user),
      this.prisma.score.findUnique({ where: { sessionId } }),
    ]);

    const enrichedEvidence = await Promise.all(
      evidence.map(async (e) => ({
        id: e.id,
        eventTable: e.eventTable,
        eventId: e.eventId,
        justification: e.justification,
        mitreTechniqueId: e.mitreTechniqueId,
        pinnedAt: e.pinnedAt,
        summary: (await summarizeEvidenceRef(this.prisma, e.eventTable, e.eventId)).summary,
      })),
    );

    return {
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        verdict: incident.verdict,
        summary: incident.summary,
        techniques: incident.techniqueLinks.map((t) => ({
          id: t.mitreTechnique.id,
          techniqueId: t.mitreTechnique.techniqueId,
          name: t.mitreTechnique.name,
        })),
        createdAt: incident.createdAt,
        closedAt: incident.closedAt,
      },
      notes: notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
      evidence: enrichedEvidence,
      timeline,
      // §6.14's overall_percent is a Postgres NUMERIC (Prisma.Decimal client-side, not a plain
      // number) — converted here rather than passed through as-is, unlike sessions.service.ts's
      // getScore() which relies on Decimal's own JSON serialization (producing a numeric
      // *string* in the response body). Converting keeps this report DTO's declared `number`
      // type actually true, rather than silently disagreeing with what's serialized.
      score: score ? { overallPercent: Number(score.overallPercent), verdictCorrect: score.verdictCorrect, scoredAt: score.scoredAt } : null,
    };
  }
}
