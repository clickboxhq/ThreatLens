import { randomUUID } from 'crypto';
import type { EmailMessage, Identity, SignInEvent } from '@prisma/client';

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

const PASSWORD_SPRAY_DISTINCT_IDENTITY_THRESHOLD = 5;

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
