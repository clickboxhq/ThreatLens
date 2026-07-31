import { randomUUID } from 'crypto';
import type { Device, EmailAttachment, EmailMessage, FileEvent, Identity, ProcessEvent, SignInEvent } from '@prisma/client';
import { distanceBetweenCitiesKm, impliedTravelSpeedKmh } from '../../common/geo';

// A detection firing, before it's turned into a persisted Alert row. Kept separate from
// the Prisma model so rule logic is a pure function of already-fetched data and is
// unit-testable without a database (§8.1, §8.2).
export interface AlertCandidate {
  id: string;
  detectionRuleName: string;
  title: string;
  description: string;
  primaryEntityType: 'identity' | 'device' | 'mailbox';
  primaryEntityId: string;
  // A rule may cite more than one supporting event (e.g. a password-spray campaign's
  // whole burst of failed sign-ins plus the eventual successful one), not just the single
  // event that made the pattern first cross threshold.
  evidenceRefs: { eventTable: string; eventId: string }[];
  correlationId: string | null;
  occurredAt: Date;
}

export const SPF_FAIL_RULE_NAME = 'Email: SPF Fail with Lookalike Sender Domain';
export const NEW_COUNTRY_RULE_NAME = 'Identity: Sign-in From New Country';
export const PASSWORD_SPRAY_RULE_NAME = 'Identity: Password Spray Campaign Detected';
export const MFA_FATIGUE_RULE_NAME = 'Identity: MFA Fatigue Pattern Detected';
export const IMPOSSIBLE_TRAVEL_RULE_NAME = 'Identity: Impossible Travel Detected';
export const OUTBOUND_PERSONAL_EMAIL_RULE_NAME = 'Email: Outbound Message to Personal Webmail with Attachment';
export const SUSPICIOUS_PROCESS_RULE_NAME = 'Device: Office Application Spawned a Script Interpreter';
export const LATERAL_MOVEMENT_RULE_NAME = 'Device: Remote Service Execution Consistent with Lateral Movement';
export const MASS_ENCRYPTION_RULE_NAME = 'Device: Mass File Encryption Detected';
export const LEGACY_AUTH_BYPASS_RULE_NAME = 'Identity: Legacy Authentication Bypassed Enforced MFA';

const PASSWORD_SPRAY_DISTINCT_IDENTITY_THRESHOLD = 5;
const MFA_FATIGUE_DENIAL_THRESHOLD = 5;
// Faster than sustained commercial subsonic flight (~880-926 km/h) — a comfortable margin
// so the rule never mistakes a fast-but-feasible trip for an impossible one.
const IMPOSSIBLE_TRAVEL_SPEED_THRESHOLD_KMH = 900;
const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
const OFFICE_APP_IMAGE_NAMES = ['WINWORD.EXE', 'EXCEL.EXE', 'OUTLOOK.EXE', 'POWERPNT.EXE'];
const SCRIPT_INTERPRETER_IMAGE_NAMES = ['POWERSHELL.EXE', 'CMD.EXE', 'WSCRIPT.EXE', 'CSCRIPT.EXE', 'MSHTA.EXE'];
const LATERAL_MOVEMENT_SERVICE_IMAGE_NAME = 'PSEXESVC.EXE';
const MASS_ENCRYPTION_COUNT_THRESHOLD = 5;
const MASS_ENCRYPTION_WINDOW_MINUTES = 15;

function imageBaseName(imagePath: string): string {
  const parts = imagePath.split(/[\\/]/);
  return (parts[parts.length - 1] ?? imagePath).toUpperCase();
}

/**
 * Fires whenever an inbound message fails SPF — deliberately naive (§8.1: realistic, not
 * omniscient), so it also fires on the seeded benign_it_admin_email_v1 noise message
 * (§8.6's intentional false positive), not only on the ground-truth phishing email.
 */
export function evaluateSpfFailRule(emails: EmailMessage[], identities: Identity[]): AlertCandidate[] {
  const identityByUpn = new Map(identities.map((i) => [i.userPrincipalName.toLowerCase(), i]));

  return emails
    .filter((email) => email.direction === 'inbound' && email.spfResult === 'fail')
    .map((email) => {
      const recipient = identityByUpn.get((email.recipientAddresses[0] ?? '').toLowerCase());
      return {
        id: randomUUID(),
        detectionRuleName: SPF_FAIL_RULE_NAME,
        title: `SPF authentication failed for message to ${recipient?.displayName ?? 'unknown recipient'}`,
        description: `An inbound message from "${email.senderAddress}" failed SPF authentication. Subject: "${email.subject}".`,
        primaryEntityType: 'mailbox' as const,
        // No standalone mailbox table exists yet (§6 leaves mailbox modeling as future work);
        // the owning identity's id stands in for the mailbox entity in the meantime.
        primaryEntityId: recipient?.id ?? email.id,
        evidenceRefs: [{ eventTable: 'email_messages', eventId: email.id }],
        correlationId: email.correlationId,
        occurredAt: email.occurredAt,
      };
    });
}

/**
 * Fires whenever a successful sign-in's source country differs from the identity's
 * home_country. This is deliberately the same pattern for both an account-takeover
 * sign-in and legitimate business travel (§8.6) — the Student has to tell them apart.
 */
export function evaluateNewCountryRule(signIns: SignInEvent[], identities: Identity[]): AlertCandidate[] {
  const identityById = new Map(identities.map((i) => [i.id, i]));

  return signIns
    .filter((event) => event.result === 'success')
    .filter((event) => {
      const identity = identityById.get(event.identityId);
      return identity && event.sourceCountry !== identity.homeCountry;
    })
    .map((event) => {
      const identity = identityById.get(event.identityId)!;
      return {
        id: randomUUID(),
        detectionRuleName: NEW_COUNTRY_RULE_NAME,
        title: `${identity.displayName} signed in from an unfamiliar country`,
        description: `Sign-in to "${event.application}" from ${event.sourceCity}, ${event.sourceCountry} — this identity's home country is ${identity.homeCountry}.`,
        primaryEntityType: 'identity' as const,
        primaryEntityId: identity.id,
        evidenceRefs: [{ eventTable: 'sign_in_events', eventId: event.id }],
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
      };
    });
}

/**
 * Fires when one source IP racks up failed sign-ins against many distinct identities —
 * a password-spray pattern — within the session. Unlike the other rules, this one
 * correlates *across* entities by construction, so it naturally produces a single alert
 * citing every supporting event (every failed attempt, plus a successful one if the spray
 * ultimately compromised an account) rather than one alert per event (§8.2).
 */
export function evaluatePasswordSprayRule(signIns: SignInEvent[], identities: Identity[]): AlertCandidate[] {
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const bySourceIp = new Map<string, SignInEvent[]>();
  for (const event of signIns) {
    const group = bySourceIp.get(event.sourceIp) ?? [];
    group.push(event);
    bySourceIp.set(event.sourceIp, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const [sourceIp, events] of bySourceIp) {
    const failedEvents = events.filter((e) => e.result === 'failure');
    const distinctFailedIdentityIds = new Set(failedEvents.map((e) => e.identityId));
    if (distinctFailedIdentityIds.size < PASSWORD_SPRAY_DISTINCT_IDENTITY_THRESHOLD) continue;

    const successEvent = events.find((e) => e.result === 'success');
    const representativeIdentity = identityById.get(successEvent?.identityId ?? failedEvents[0].identityId)!;
    const latestEvent = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];

    candidates.push({
      id: randomUUID(),
      detectionRuleName: PASSWORD_SPRAY_RULE_NAME,
      title: successEvent
        ? `Password spray campaign from ${sourceIp} compromised ${representativeIdentity.displayName}'s account`
        : `Password spray campaign detected from ${sourceIp}`,
      description: successEvent
        ? `${distinctFailedIdentityIds.size} accounts received failed sign-in attempts from ${sourceIp} in a short window, followed by a successful sign-in to ${representativeIdentity.displayName}'s account from the same address.`
        : `${distinctFailedIdentityIds.size} accounts received failed sign-in attempts from ${sourceIp} in a short window. No successful sign-in from this address was observed.`,
      primaryEntityType: 'identity' as const,
      primaryEntityId: representativeIdentity.id,
      evidenceRefs: events.map((e) => ({ eventTable: 'sign_in_events', eventId: e.id })),
      correlationId: null,
      occurredAt: latestEvent.occurredAt,
    });
  }
  return candidates;
}

/**
 * Fires when one identity racks up several MFA-denied results from one source IP in a
 * short window — a push-bombing/MFA-fatigue attack — regardless of whether it eventually
 * succeeds. Unlike password spraying (many identities, one IP), this is one identity
 * hit repeatedly (§8.2).
 */
export function evaluateMfaFatigueRule(signIns: SignInEvent[], identities: Identity[]): AlertCandidate[] {
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const byIdentityAndIp = new Map<string, SignInEvent[]>();
  for (const event of signIns) {
    const key = `${event.identityId}::${event.sourceIp}`;
    const group = byIdentityAndIp.get(key) ?? [];
    group.push(event);
    byIdentityAndIp.set(key, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const events of byIdentityAndIp.values()) {
    const deniedEvents = events.filter((e) => e.result === 'mfa_denied');
    if (deniedEvents.length < MFA_FATIGUE_DENIAL_THRESHOLD) continue;

    const identity = identityById.get(deniedEvents[0].identityId);
    if (!identity) continue;
    const successEvent = events.find((e) => e.result === 'success');
    const latestEvent = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];

    candidates.push({
      id: randomUUID(),
      detectionRuleName: MFA_FATIGUE_RULE_NAME,
      title: successEvent
        ? `${identity.displayName} approved an MFA prompt after a push-bombing burst`
        : `MFA fatigue pattern detected against ${identity.displayName}`,
      description: successEvent
        ? `${deniedEvents.length} MFA prompts were denied in quick succession from ${deniedEvents[0].sourceIp}, then one was approved — a classic push-bombing pattern.`
        : `${deniedEvents.length} MFA prompts were denied in quick succession from ${deniedEvents[0].sourceIp}. No approval was observed.`,
      primaryEntityType: 'identity' as const,
      primaryEntityId: identity.id,
      evidenceRefs: events
        .filter((e) => e.result === 'mfa_denied' || e.result === 'success')
        .map((e) => ({ eventTable: 'sign_in_events', eventId: e.id })),
      correlationId: null,
      occurredAt: latestEvent.occurredAt,
    });
  }
  return candidates;
}

/**
 * Fires when the implied speed between two consecutive successful sign-ins for the same
 * identity exceeds what's physically feasible — the classic impossible-travel heuristic
 * (§9.6), computed with the same geo helper the Identity Portal itself uses so an
 * investigator's manual reasoning and the automated alert agree.
 */
export function evaluateImpossibleTravelRule(signIns: SignInEvent[], identities: Identity[]): AlertCandidate[] {
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const byIdentity = new Map<string, SignInEvent[]>();
  for (const event of signIns) {
    if (event.result !== 'success') continue;
    const group = byIdentity.get(event.identityId) ?? [];
    group.push(event);
    byIdentity.set(event.identityId, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const [identityId, events] of byIdentity) {
    const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const identity = identityById.get(identityId);
    if (!identity) continue;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.sourceCity === curr.sourceCity) continue;

      const distanceKm = distanceBetweenCitiesKm(prev.sourceCity, curr.sourceCity);
      if (distanceKm === null) continue;
      const minutesElapsed = (curr.occurredAt.getTime() - prev.occurredAt.getTime()) / 60000;
      const speedKmh = impliedTravelSpeedKmh(distanceKm, minutesElapsed);
      if (speedKmh === null || speedKmh < IMPOSSIBLE_TRAVEL_SPEED_THRESHOLD_KMH) continue;

      candidates.push({
        id: randomUUID(),
        detectionRuleName: IMPOSSIBLE_TRAVEL_RULE_NAME,
        title: `${identity.displayName}'s sign-ins imply impossible travel`,
        description: `Sign-in from ${prev.sourceCity} was followed ${Math.round(minutesElapsed)} minutes later by a sign-in from ${curr.sourceCity} — an implied speed of ~${Math.round(speedKmh).toLocaleString()} km/h, far beyond feasible travel.`,
        primaryEntityType: 'identity' as const,
        primaryEntityId: identity.id,
        evidenceRefs: [
          { eventTable: 'sign_in_events', eventId: prev.id },
          { eventTable: 'sign_in_events', eventId: curr.id },
        ],
        correlationId: curr.correlationId,
        occurredAt: curr.occurredAt,
      });
    }
  }
  return candidates;
}

/**
 * Fires on an outbound message, with at least one attachment, to a well-known personal
 * webmail domain — a common data-exfiltration/insider-threat pattern that has nothing to
 * do with a spoofed sender (§8.2): the message is genuinely sent by the organization's own
 * mail system, so SPF/DKIM/DMARC all legitimately pass, unlike every other rule so far.
 */
export function evaluateOutboundPersonalEmailRule(emails: EmailMessage[], attachments: EmailAttachment[]): AlertCandidate[] {
  const emailIdsWithAttachments = new Set(attachments.map((a) => a.emailMessageId));

  return emails
    .filter((email) => email.direction === 'outbound')
    .filter((email) => emailIdsWithAttachments.has(email.id))
    .filter((email) => email.recipientAddresses.some((addr) => PERSONAL_EMAIL_DOMAINS.some((d) => addr.toLowerCase().endsWith(`@${d}`))))
    .map((email) => ({
      id: randomUUID(),
      detectionRuleName: OUTBOUND_PERSONAL_EMAIL_RULE_NAME,
      title: `Outbound message with attachment sent to a personal email address`,
      description: `A message from "${email.senderAddress}" was sent to "${email.recipientAddresses[0]}" — a personal webmail address, not an organizational one. Subject: "${email.subject}".`,
      primaryEntityType: 'mailbox' as const,
      primaryEntityId: email.id,
      evidenceRefs: [{ eventTable: 'email_messages', eventId: email.id }],
      correlationId: email.correlationId,
      occurredAt: email.occurredAt,
    }));
}

/**
 * Fires when an Office application appears as the direct parent of a script interpreter or
 * command shell — one of the most well-known endpoint LOLBin patterns (a macro-driven
 * document spawning PowerShell/cmd/wscript), and the first rule scoped to a device rather
 * than an identity or mailbox (§8.2, §10.3).
 */
export function evaluateSuspiciousProcessRule(processEvents: ProcessEvent[], devices: Device[]): AlertCandidate[] {
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const byGuid = new Map(processEvents.map((p) => [p.processGuid, p]));

  const candidates: AlertCandidate[] = [];
  for (const child of processEvents) {
    if (!child.parentProcessGuid) continue;
    const parent = byGuid.get(child.parentProcessGuid);
    if (!parent) continue;

    const parentName = imageBaseName(parent.imagePath);
    const childName = imageBaseName(child.imagePath);
    if (!OFFICE_APP_IMAGE_NAMES.includes(parentName) || !SCRIPT_INTERPRETER_IMAGE_NAMES.includes(childName)) continue;

    const device = deviceById.get(child.deviceId);
    if (!device) continue;

    candidates.push({
      id: randomUUID(),
      detectionRuleName: SUSPICIOUS_PROCESS_RULE_NAME,
      title: `${parentName} on ${device.hostname} spawned ${childName}`,
      description: `"${parent.imagePath}" launched "${child.imagePath}" with command line: ${child.commandLine}`,
      primaryEntityType: 'device' as const,
      primaryEntityId: device.id,
      evidenceRefs: [
        { eventTable: 'process_events', eventId: parent.id },
        { eventTable: 'process_events', eventId: child.id },
      ],
      correlationId: child.correlationId,
      occurredAt: child.occurredAt,
    });
  }
  return candidates;
}

/**
 * Fires when PSEXESVC.exe — the service binary PsExec installs on a target host to run a
 * command remotely — appears in a device's process tree. Its mere presence is the
 * detection signal (real admin tooling like PsExec is rarely used this way inside the
 * scenarios' orgs), so this rule cites the service process itself plus its parent
 * (normally services.exe, the Service Control Manager) and any children it spawned,
 * without needing to know which device the connection originated from (§10.3, ransomware
 * lateral-movement narrative).
 */
export function evaluateLateralMovementRule(processEvents: ProcessEvent[], devices: Device[]): AlertCandidate[] {
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const byGuid = new Map(processEvents.map((p) => [p.processGuid, p]));
  const childrenByParentGuid = new Map<string, ProcessEvent[]>();
  for (const event of processEvents) {
    if (!event.parentProcessGuid) continue;
    const group = childrenByParentGuid.get(event.parentProcessGuid) ?? [];
    group.push(event);
    childrenByParentGuid.set(event.parentProcessGuid, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const event of processEvents) {
    if (imageBaseName(event.imagePath) !== LATERAL_MOVEMENT_SERVICE_IMAGE_NAME) continue;
    const device = deviceById.get(event.deviceId);
    if (!device) continue;

    const parent = event.parentProcessGuid ? byGuid.get(event.parentProcessGuid) : undefined;
    const children = childrenByParentGuid.get(event.processGuid) ?? [];

    candidates.push({
      id: randomUUID(),
      detectionRuleName: LATERAL_MOVEMENT_RULE_NAME,
      title: `Remote service execution detected on ${device.hostname}`,
      description: `"${event.imagePath}" was created on ${device.hostname}${parent ? ` by "${parent.imagePath}"` : ''} — the artifact PsExec-style tools leave when they run a command on a remote host using stolen credentials.`,
      primaryEntityType: 'device' as const,
      primaryEntityId: device.id,
      evidenceRefs: [
        ...(parent ? [{ eventTable: 'process_events', eventId: parent.id }] : []),
        { eventTable: 'process_events', eventId: event.id },
        ...children.map((c) => ({ eventTable: 'process_events', eventId: c.id })),
      ],
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
    });
  }
  return candidates;
}

/**
 * Fires when one device racks up several `encrypted` file-action events in a short window —
 * the observable signature of ransomware working through a file share, independent of any
 * single file's content (§10.5's `encrypted` action exists specifically for this).
 */
export function evaluateMassEncryptionRule(fileEvents: FileEvent[], devices: Device[]): AlertCandidate[] {
  const deviceById = new Map(devices.map((d) => [d.id, d]));
  const byDevice = new Map<string, FileEvent[]>();
  for (const event of fileEvents) {
    if (event.action !== 'encrypted') continue;
    const group = byDevice.get(event.deviceId) ?? [];
    group.push(event);
    byDevice.set(event.deviceId, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const [deviceId, events] of byDevice) {
    const device = deviceById.get(deviceId);
    if (!device) continue;
    const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    for (let i = 0; i < sorted.length; i++) {
      const windowEnd = new Date(sorted[i].occurredAt.getTime() + MASS_ENCRYPTION_WINDOW_MINUTES * 60 * 1000);
      const cluster = sorted.slice(i).filter((e) => e.occurredAt <= windowEnd);
      if (cluster.length < MASS_ENCRYPTION_COUNT_THRESHOLD) continue;

      const latest = cluster[cluster.length - 1];
      candidates.push({
        id: randomUUID(),
        detectionRuleName: MASS_ENCRYPTION_RULE_NAME,
        title: `Mass file encryption detected on ${device.hostname}`,
        description: `${cluster.length} files were encrypted on ${device.hostname} within ${MASS_ENCRYPTION_WINDOW_MINUTES} minutes — consistent with ransomware working through a file share.`,
        primaryEntityType: 'device' as const,
        primaryEntityId: device.id,
        evidenceRefs: cluster.map((e) => ({ eventTable: 'file_events', eventId: e.id })),
        correlationId: latest.correlationId,
        occurredAt: latest.occurredAt,
      });
      break; // one alert per device is enough; the whole burst is already cited.
    }
  }
  return candidates;
}

/**
 * Fires when a successful sign-in used a legacy authentication protocol (IMAP4, POP3, older
 * ActiveSync clients) on an identity whose MFA is supposedly "enforced" — legacy protocols
 * predate modern MFA challenges, so a Conditional Access policy that isn't explicitly
 * configured to block them lets credentials alone through. Groups every such sign-in per
 * identity into one alert, the same shape as the MFA-fatigue and password-spray rules,
 * since a single bypass is rarely a one-off (§9's identity investigation surface).
 */
export function evaluateLegacyAuthBypassRule(signIns: SignInEvent[], identities: Identity[]): AlertCandidate[] {
  const identityById = new Map(identities.map((i) => [i.id, i]));
  const byIdentity = new Map<string, SignInEvent[]>();
  for (const event of signIns) {
    if (event.result !== 'success' || !event.isLegacyAuth) continue;
    const identity = identityById.get(event.identityId);
    if (!identity || identity.mfaStatus !== 'enforced') continue;
    const group = byIdentity.get(event.identityId) ?? [];
    group.push(event);
    byIdentity.set(event.identityId, group);
  }

  const candidates: AlertCandidate[] = [];
  for (const [identityId, events] of byIdentity) {
    const identity = identityById.get(identityId)!;
    const latest = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];

    candidates.push({
      id: randomUUID(),
      detectionRuleName: LEGACY_AUTH_BYPASS_RULE_NAME,
      title: `${identity.displayName} authenticated via legacy protocol despite MFA enforcement`,
      description: `${events.length} successful sign-in${events.length === 1 ? '' : 's'} to "${events[0].application}" via ${events[0].clientApp} bypassed this identity's enforced MFA policy — legacy authentication protocols don't support modern MFA challenges.`,
      primaryEntityType: 'identity' as const,
      primaryEntityId: identity.id,
      evidenceRefs: events.map((e) => ({ eventTable: 'sign_in_events', eventId: e.id })),
      correlationId: latest.correlationId,
      occurredAt: latest.occurredAt,
    });
  }
  return candidates;
}

/**
 * §8.3: link two candidates that share a correlation_id (assigned by the Telemetry
 * Generator, §7.2 stage 4) into a related pair, returned as [fromId, toId] tuples.
 */
export function correlateCandidates(candidates: AlertCandidate[]): [string, string][] {
  const byCorrelationId = new Map<string, AlertCandidate[]>();
  for (const candidate of candidates) {
    if (!candidate.correlationId) continue;
    const group = byCorrelationId.get(candidate.correlationId) ?? [];
    group.push(candidate);
    byCorrelationId.set(candidate.correlationId, group);
  }

  const links: [string, string][] = [];
  for (const group of byCorrelationId.values()) {
    for (let i = 1; i < group.length; i++) {
      links.push([group[0].id, group[i].id]);
    }
  }
  return links;
}
