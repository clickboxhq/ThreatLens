import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AlertCandidate,
  correlateCandidates,
  evaluateNewCountryRule,
  evaluateSpfFailRule,
  NEW_COUNTRY_RULE_NAME,
  SPF_FAIL_RULE_NAME,
} from './rules';

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** §8.4: evaluates every active rule against the session's telemetry and persists alerts. */
  async evaluateForSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.alert.count({ where: { sessionId } });
    if (existing > 0) {
      this.logger.log(`Session ${sessionId} already has alerts; skipping (idempotent).`);
      return;
    }

    const [emails, signIns, identities, spfRule, newCountryRule] = await Promise.all([
      this.prisma.emailMessage.findMany({ where: { sessionId } }),
      this.prisma.signInEvent.findMany({ where: { sessionId } }),
      this.prisma.identity.findMany({ where: { sessionId } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SPF_FAIL_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: NEW_COUNTRY_RULE_NAME } }),
    ]);

    const emailCandidates = evaluateSpfFailRule(emails, identities);
    const signInCandidates = evaluateNewCountryRule(signIns, identities);
    const allCandidates = [...emailCandidates, ...signInCandidates];
    const links = correlateCandidates(allCandidates);

    const ruleByName = new Map([
      [SPF_FAIL_RULE_NAME, spfRule],
      [NEW_COUNTRY_RULE_NAME, newCountryRule],
    ]);

    await this.prisma.$transaction(
      allCandidates.map((candidate) => {
        const rule = ruleByName.get(candidate.detectionRuleName)!;
        return this.prisma.alert.create({
          data: {
            id: candidate.id,
            sessionId,
            title: candidate.title,
            description: candidate.description,
            severity: rule.defaultSeverity,
            status: 'new',
            primaryEntityType: candidate.primaryEntityType,
            primaryEntityId: candidate.primaryEntityId,
            mitreTechniqueId: rule.mitreTechniqueId,
            detectionRuleId: rule.id,
            firstSeenAt: candidate.occurredAt,
            lastSeenAt: candidate.occurredAt,
            evidenceRefs: {
              create: [{ eventTable: candidate.eventTable, eventId: candidate.eventId }],
            },
          },
        });
      }),
    );

    if (links.length > 0) {
      await this.prisma.$transaction(
        links.map(([fromId, toId]) =>
          this.prisma.alert.update({ where: { id: toId }, data: { relatedAlertId: fromId } }),
        ),
      );
    }

    this.logger.log(`Generated ${allCandidates.length} alerts (${links.length} correlated) for session ${sessionId}.`);
  }
}

export type { AlertCandidate };
