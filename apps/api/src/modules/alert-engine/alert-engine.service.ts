import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeEventsService } from '../../common/realtime/realtime-events.service';
import { toStudentAlertDto } from '../../common/dto/alert.dto';
import {
  AlertCandidate,
  correlateCandidates,
  evaluateCredentialDumpingRule,
  evaluateImpossibleTravelRule,
  evaluateLateralMovementRule,
  evaluateLegacyAuthBypassRule,
  evaluateMassEncryptionRule,
  evaluateMfaFatigueRule,
  evaluateNewCountryRule,
  evaluateOutboundPersonalEmailRule,
  evaluatePasswordSprayRule,
  evaluatePersistenceArtifactRule,
  evaluateRemovableMediaCopyRule,
  evaluateScheduledTaskPersistenceRule,
  evaluateSpfFailRule,
  evaluateSqlInjectionRule,
  evaluateSuspiciousCloudActionRule,
  evaluateSuspiciousProcessRule,
  evaluateWebShellAccessRule,
  CREDENTIAL_DUMPING_RULE_NAME,
  IMPOSSIBLE_TRAVEL_RULE_NAME,
  LATERAL_MOVEMENT_RULE_NAME,
  LEGACY_AUTH_BYPASS_RULE_NAME,
  MASS_ENCRYPTION_RULE_NAME,
  MFA_FATIGUE_RULE_NAME,
  NEW_COUNTRY_RULE_NAME,
  OUTBOUND_PERSONAL_EMAIL_RULE_NAME,
  PASSWORD_SPRAY_RULE_NAME,
  PERSISTENCE_ARTIFACT_RULE_NAME,
  REMOVABLE_MEDIA_COPY_RULE_NAME,
  SCHEDULED_TASK_PERSISTENCE_RULE_NAME,
  SPF_FAIL_RULE_NAME,
  SQL_INJECTION_RULE_NAME,
  SUSPICIOUS_CLOUD_ACTION_RULE_NAME,
  SUSPICIOUS_PROCESS_RULE_NAME,
  WEBSHELL_ACCESS_RULE_NAME,
} from './rules';

@Injectable()
export class AlertEngineService {
  private readonly logger = new Logger(AlertEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  /** §8.4: evaluates every active rule against the session's telemetry and persists alerts. */
  async evaluateForSession(sessionId: string): Promise<void> {
    const existing = await this.prisma.alert.count({ where: { sessionId } });
    if (existing > 0) {
      this.logger.log(`Session ${sessionId} already has alerts; skipping (idempotent).`);
      return;
    }

    const [
      emails,
      attachments,
      signIns,
      identities,
      processEvents,
      fileEvents,
      cloudEvents,
      httpRequests,
      devices,
      spfRule,
      newCountryRule,
      passwordSprayRule,
      mfaFatigueRule,
      impossibleTravelRule,
      outboundPersonalEmailRule,
      suspiciousProcessRule,
      lateralMovementRule,
      massEncryptionRule,
      legacyAuthBypassRule,
      suspiciousCloudActionRule,
      webShellAccessRule,
      persistenceArtifactRule,
      credentialDumpingRule,
      removableMediaCopyRule,
      sqlInjectionRule,
      scheduledTaskPersistenceRule,
    ] = await Promise.all([
      this.prisma.emailMessage.findMany({ where: { sessionId } }),
      this.prisma.emailAttachment.findMany({ where: { emailMessage: { sessionId } } }),
      this.prisma.signInEvent.findMany({ where: { sessionId } }),
      this.prisma.identity.findMany({ where: { sessionId } }),
      this.prisma.processEvent.findMany({ where: { sessionId } }),
      this.prisma.fileEvent.findMany({ where: { sessionId } }),
      this.prisma.cloudEvent.findMany({ where: { sessionId } }),
      this.prisma.httpRequest.findMany({ where: { sessionId } }),
      this.prisma.device.findMany({ where: { sessionId } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SPF_FAIL_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: NEW_COUNTRY_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: PASSWORD_SPRAY_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: MFA_FATIGUE_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: IMPOSSIBLE_TRAVEL_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: OUTBOUND_PERSONAL_EMAIL_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SUSPICIOUS_PROCESS_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: LATERAL_MOVEMENT_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: MASS_ENCRYPTION_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: LEGACY_AUTH_BYPASS_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SUSPICIOUS_CLOUD_ACTION_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: WEBSHELL_ACCESS_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: PERSISTENCE_ARTIFACT_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: CREDENTIAL_DUMPING_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: REMOVABLE_MEDIA_COPY_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SQL_INJECTION_RULE_NAME } }),
      this.prisma.detectionRule.findFirstOrThrow({ where: { name: SCHEDULED_TASK_PERSISTENCE_RULE_NAME } }),
    ]);

    const allCandidates: AlertCandidate[] = [
      ...evaluateSpfFailRule(emails, identities),
      ...evaluateNewCountryRule(signIns, identities),
      ...evaluatePasswordSprayRule(signIns, identities),
      ...evaluateMfaFatigueRule(signIns, identities),
      ...evaluateImpossibleTravelRule(signIns, identities),
      ...evaluateOutboundPersonalEmailRule(emails, attachments),
      ...evaluateSuspiciousProcessRule(processEvents, devices),
      ...evaluateLateralMovementRule(processEvents, devices),
      ...evaluateMassEncryptionRule(fileEvents, devices),
      ...evaluateLegacyAuthBypassRule(signIns, identities),
      ...evaluateSuspiciousCloudActionRule(cloudEvents, identities),
      ...evaluateWebShellAccessRule(httpRequests, devices),
      ...evaluatePersistenceArtifactRule(fileEvents, devices),
      ...evaluateCredentialDumpingRule(processEvents, devices),
      ...evaluateRemovableMediaCopyRule(fileEvents, devices),
      ...evaluateSqlInjectionRule(httpRequests, devices),
      ...evaluateScheduledTaskPersistenceRule(processEvents, devices),
    ];
    const links = correlateCandidates(allCandidates);

    // §8.6: an alert is "false-positive by design" when every event it cites is noise —
    // none of its evidence was authored as part of the attack narrative. This has to be
    // decided here, not inside a rule (§8.1's rules are deliberately blind to ground truth
    // so they fire realistically on noise too), and it's the only source that ever sets
    // `isFalsePositiveByDesign`, which the Scoring Engine's false-positive-handling
    // component (§12.4) depends on.
    const groundTruthByKey = new Map<string, boolean>();
    for (const e of emails) groundTruthByKey.set(`email_messages:${e.id}`, e.isGroundTruthEvidence);
    for (const e of signIns) groundTruthByKey.set(`sign_in_events:${e.id}`, e.isGroundTruthEvidence);
    for (const e of processEvents) groundTruthByKey.set(`process_events:${e.id}`, e.isGroundTruthEvidence);
    for (const e of fileEvents) groundTruthByKey.set(`file_events:${e.id}`, e.isGroundTruthEvidence);
    for (const e of cloudEvents) groundTruthByKey.set(`cloud_events:${e.id}`, e.isGroundTruthEvidence);
    for (const e of httpRequests) groundTruthByKey.set(`http_requests:${e.id}`, e.isGroundTruthEvidence);
    const isFalsePositiveByDesign = (candidate: AlertCandidate) =>
      candidate.evidenceRefs.length > 0 &&
      candidate.evidenceRefs.every((ref) => groundTruthByKey.get(`${ref.eventTable}:${ref.eventId}`) === false);

    const ruleByName = new Map([
      [SPF_FAIL_RULE_NAME, spfRule],
      [NEW_COUNTRY_RULE_NAME, newCountryRule],
      [PASSWORD_SPRAY_RULE_NAME, passwordSprayRule],
      [MFA_FATIGUE_RULE_NAME, mfaFatigueRule],
      [IMPOSSIBLE_TRAVEL_RULE_NAME, impossibleTravelRule],
      [OUTBOUND_PERSONAL_EMAIL_RULE_NAME, outboundPersonalEmailRule],
      [SUSPICIOUS_PROCESS_RULE_NAME, suspiciousProcessRule],
      [LATERAL_MOVEMENT_RULE_NAME, lateralMovementRule],
      [MASS_ENCRYPTION_RULE_NAME, massEncryptionRule],
      [LEGACY_AUTH_BYPASS_RULE_NAME, legacyAuthBypassRule],
      [SUSPICIOUS_CLOUD_ACTION_RULE_NAME, suspiciousCloudActionRule],
      [WEBSHELL_ACCESS_RULE_NAME, webShellAccessRule],
      [PERSISTENCE_ARTIFACT_RULE_NAME, persistenceArtifactRule],
      [CREDENTIAL_DUMPING_RULE_NAME, credentialDumpingRule],
      [REMOVABLE_MEDIA_COPY_RULE_NAME, removableMediaCopyRule],
      [SQL_INJECTION_RULE_NAME, sqlInjectionRule],
      [SCHEDULED_TASK_PERSISTENCE_RULE_NAME, scheduledTaskPersistenceRule],
    ]);

    const createdAlerts = await this.prisma.$transaction(
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
            isFalsePositiveByDesign: isFalsePositiveByDesign(candidate),
            firstSeenAt: candidate.occurredAt,
            lastSeenAt: candidate.occurredAt,
            evidenceRefs: {
              create: candidate.evidenceRefs.map((ref) => ({ eventTable: ref.eventTable, eventId: ref.eventId })),
            },
          },
          include: { mitreTechnique: true },
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

    // §16.16: pushed after the DB transaction commits, through the same Student-safe DTO
    // every REST alert response uses — the socket message is a convenience notification,
    // never a second source of truth with its own field allow-list to maintain (§12.3).
    // Fired concurrently, not one at a time in sequence — a scenario with a dozen alerts
    // should arrive at the client as one tight burst the frontend can debounce into a
    // single refetch, not trickle in over several seconds of sequential Redis round-trips.
    await Promise.all(
      createdAlerts.map((alert) =>
        this.realtimeEvents.publish(sessionId, { type: 'alert.new', payload: toStudentAlertDto(alert) }),
      ),
    );

    this.logger.log(`Generated ${allCandidates.length} alerts (${links.length} correlated) for session ${sessionId}.`);
  }
}

export type { AlertCandidate };
