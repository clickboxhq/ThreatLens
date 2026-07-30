import { randomUUID } from 'crypto';
import type { Device, EmailAttachment, EmailMessage, Identity, ProcessEvent, SignInEvent } from '@prisma/client';
import {
  correlateCandidates,
  evaluateImpossibleTravelRule,
  evaluateMfaFatigueRule,
  evaluateNewCountryRule,
  evaluateOutboundPersonalEmailRule,
  evaluatePasswordSprayRule,
  evaluateSpfFailRule,
  evaluateSuspiciousProcessRule,
} from './rules';

function identity(overrides: Partial<Identity> = {}): Identity {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    displayName: 'Test Victim',
    userPrincipalName: 'test.victim@contoso-finance.example.com',
    department: 'Finance',
    jobTitle: 'Accounts Payable Specialist',
    managerIdentityId: null,
    riskLevel: 'none',
    mfaStatus: 'enforced',
    accountStatus: 'active',
    isPrivileged: false,
    homeCountry: 'US',
    isGroundTruthActor: true,
  } as Identity;
}

function email(overrides: Partial<EmailMessage> = {}, recipientUpn: string): EmailMessage {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    messageId: '<test@example.com>',
    direction: 'inbound',
    senderAddress: 'billing@secure-invoice-portal-verify.com',
    senderDisplayName: 'Accounts Payable Portal',
    recipientAddresses: [recipientUpn],
    subject: 'Invoice',
    bodyHtml: '<p>test</p>',
    headersRaw: {},
    spfResult: 'fail',
    dkimResult: 'none',
    dmarcResult: 'fail',
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    ...overrides,
  } as EmailMessage;
}

function signIn(identityId: string, overrides: Partial<SignInEvent> = {}): SignInEvent {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: false,
    mitreTechniqueId: null,
    identityId,
    deviceId: null,
    sourceIp: '203.0.113.10',
    sourceCountry: 'RO',
    sourceCity: 'Bucharest',
    application: 'Office 365 Exchange Online',
    result: 'success',
    failureReason: null,
    isLegacyAuth: false,
    clientApp: 'Modern Auth Client',
    ...overrides,
  } as SignInEvent;
}

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    hostname: 'FIN-WKS-07',
    osPlatform: 'windows',
    osVersion: '11 23H2',
    primaryIdentityId: null,
    riskLevel: 'none',
    isolationStatus: 'not_isolated',
    lastSeenAt: new Date(),
    isGroundTruthActor: true,
    ...overrides,
  } as Device;
}

function processEvent(deviceId: string, overrides: Partial<ProcessEvent> = {}): ProcessEvent {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    deviceId,
    processGuid: randomUUID(),
    parentProcessGuid: null,
    imagePath: 'C:\\Windows\\System32\\notepad.exe',
    commandLine: 'notepad.exe',
    hashSha256: 'a'.repeat(64),
    parentImagePath: null,
    integrityLevel: 'Medium',
    identityId: null,
    ...overrides,
  } as ProcessEvent;
}

function attachment(emailMessageId: string, overrides: Partial<EmailAttachment> = {}): EmailAttachment {
  return {
    id: randomUUID(),
    emailMessageId,
    filename: 'Q3_Customer_Contracts_Export.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 48213,
    hashSha256: 'a'.repeat(64),
    sandboxVerdict: 'benign',
    ...overrides,
  } as EmailAttachment;
}

describe('evaluateSpfFailRule (§8.2)', () => {
  it('fires on an inbound SPF-fail email, including a benign one (§8.6)', () => {
    const victim = identity();
    const maliciousEmail = email({ isGroundTruthEvidence: true }, victim.userPrincipalName);
    const benignEmail = email(
      { isGroundTruthEvidence: false, senderAddress: 'it@contoso-finance-support.example.com', subject: 'Maintenance' },
      victim.userPrincipalName,
    );

    const candidates = evaluateSpfFailRule([maliciousEmail, benignEmail], [victim]);
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.primaryEntityId === victim.id)).toBe(true);
  });

  it('does not fire on an SPF-pass email', () => {
    const victim = identity();
    const cleanEmail = email({ spfResult: 'pass' }, victim.userPrincipalName);
    expect(evaluateSpfFailRule([cleanEmail], [victim])).toHaveLength(0);
  });
});

describe('evaluateNewCountryRule (§8.2)', () => {
  it('fires when source country differs from home country, for both risky and benign travel (§8.6)', () => {
    const victim = identity({ homeCountry: 'US' });
    const riskySignIn = signIn(victim.id, { sourceCountry: 'RO', isGroundTruthEvidence: true });
    const travelSignIn = signIn(victim.id, { sourceCountry: 'FR', isGroundTruthEvidence: false });
    const baselineSignIn = signIn(victim.id, { sourceCountry: 'US' });

    const candidates = evaluateNewCountryRule([riskySignIn, travelSignIn, baselineSignIn], [victim]);
    expect(candidates).toHaveLength(2);
  });

  it('does not fire on a failed sign-in', () => {
    const victim = identity();
    const failed = signIn(victim.id, { sourceCountry: 'RO', result: 'failure' });
    expect(evaluateNewCountryRule([failed], [victim])).toHaveLength(0);
  });
});

describe('evaluatePasswordSprayRule (§8.2)', () => {
  it('fires once for a source IP with failed attempts against >= 5 distinct identities, citing every event', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 6 }, () => identity());
    const failedAttempts = targets.map((t) => signIn(t.id, { sourceIp: attackerIp, result: 'failure' }));
    const unrelatedBaseline = signIn(targets[0].id, { sourceIp: '10.0.0.1', result: 'success', sourceCountry: 'US' });

    const candidates = evaluatePasswordSprayRule([...failedAttempts, unrelatedBaseline], targets);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
    expect(candidates[0].evidenceRefs.map((r) => r.eventId).sort()).toEqual(failedAttempts.map((e) => e.id).sort());
  });

  it('does not fire below the distinct-identity threshold', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 4 }, () => identity());
    const failedAttempts = targets.map((t) => signIn(t.id, { sourceIp: attackerIp, result: 'failure' }));

    expect(evaluatePasswordSprayRule(failedAttempts, targets)).toHaveLength(0);
  });

  it('names the compromised identity and includes the success event when the spray succeeded', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 5 }, () => identity());
    const failedAttempts = targets.map((t) => signIn(t.id, { sourceIp: attackerIp, result: 'failure' }));
    const compromised = targets[2];
    const successEvent = signIn(compromised.id, { sourceIp: attackerIp, result: 'success', sourceCountry: 'RO' });

    const candidates = evaluatePasswordSprayRule([...failedAttempts, successEvent], targets);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityId).toBe(compromised.id);
    expect(candidates[0].title).toContain(compromised.displayName);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('does not conflate failed attempts from different source IPs', () => {
    const targets = Array.from({ length: 10 }, () => identity());
    const fromIpA = targets.slice(0, 3).map((t) => signIn(t.id, { sourceIp: '198.51.100.1', result: 'failure' }));
    const fromIpB = targets.slice(3, 6).map((t) => signIn(t.id, { sourceIp: '198.51.100.2', result: 'failure' }));

    expect(evaluatePasswordSprayRule([...fromIpA, ...fromIpB], targets)).toHaveLength(0);
  });
});

describe('evaluateMfaFatigueRule (§8.2)', () => {
  it('fires when one identity gets >= 5 mfa_denied results from one IP', () => {
    const victim = identity();
    const attackerIp = '198.51.100.20';
    const denials = Array.from({ length: 6 }, () => signIn(victim.id, { sourceIp: attackerIp, result: 'mfa_denied' }));

    const candidates = evaluateMfaFatigueRule(denials, [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityId).toBe(victim.id);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('includes the eventual success in evidence and names it in the title', () => {
    const victim = identity();
    const attackerIp = '198.51.100.20';
    const denials = Array.from({ length: 5 }, () => signIn(victim.id, { sourceIp: attackerIp, result: 'mfa_denied' }));
    const success = signIn(victim.id, { sourceIp: attackerIp, result: 'success' });

    const candidates = evaluateMfaFatigueRule([...denials, success], [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
    expect(candidates[0].title).toContain(victim.displayName);
  });

  it('does not fire below the denial threshold', () => {
    const victim = identity();
    const denials = Array.from({ length: 4 }, () => signIn(victim.id, { sourceIp: '198.51.100.20', result: 'mfa_denied' }));
    expect(evaluateMfaFatigueRule(denials, [victim])).toHaveLength(0);
  });

  it('does not conflate denials against different identities from the same IP (that is password spray, not MFA fatigue)', () => {
    const targets = Array.from({ length: 6 }, () => identity());
    const denials = targets.map((t) => signIn(t.id, { sourceIp: '198.51.100.20', result: 'mfa_denied' }));
    expect(evaluateMfaFatigueRule(denials, targets)).toHaveLength(0);
  });
});

describe('evaluateImpossibleTravelRule (§8.2, §9.6)', () => {
  it('fires when two consecutive successful sign-ins imply an infeasible travel speed', () => {
    const victim = identity();
    const first = signIn(victim.id, {
      sourceCity: 'Chicago',
      sourceCountry: 'US',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
    });
    const second = signIn(victim.id, {
      sourceCity: 'Tokyo',
      sourceCountry: 'JP',
      occurredAt: new Date('2026-01-01T10:45:00Z'),
    });

    const candidates = evaluateImpossibleTravelRule([first, second], [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs.map((r) => r.eventId).sort()).toEqual([first.id, second.id].sort());
  });

  it('does not fire for a feasible travel time between two cities', () => {
    const victim = identity();
    const first = signIn(victim.id, {
      sourceCity: 'Chicago',
      sourceCountry: 'US',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
    });
    const second = signIn(victim.id, {
      sourceCity: 'Toronto',
      sourceCountry: 'CA',
      occurredAt: new Date('2026-01-02T10:00:00Z'), // 24 hours later — plenty of time
    });

    expect(evaluateImpossibleTravelRule([first, second], [victim])).toHaveLength(0);
  });

  it('ignores failed sign-ins entirely', () => {
    const victim = identity();
    const first = signIn(victim.id, { sourceCity: 'Chicago', result: 'failure', occurredAt: new Date('2026-01-01T10:00:00Z') });
    const second = signIn(victim.id, { sourceCity: 'Tokyo', result: 'failure', occurredAt: new Date('2026-01-01T10:45:00Z') });
    expect(evaluateImpossibleTravelRule([first, second], [victim])).toHaveLength(0);
  });

  it('does not fire for consecutive sign-ins from the same city', () => {
    const victim = identity();
    const first = signIn(victim.id, { sourceCity: 'Chicago', occurredAt: new Date('2026-01-01T10:00:00Z') });
    const second = signIn(victim.id, { sourceCity: 'Chicago', occurredAt: new Date('2026-01-01T10:05:00Z') });
    expect(evaluateImpossibleTravelRule([first, second], [victim])).toHaveLength(0);
  });
});

describe('evaluateOutboundPersonalEmailRule (§8.2)', () => {
  it('fires on an outbound message with an attachment sent to a personal webmail address', () => {
    const victim = identity();
    const msg = email(
      { direction: 'outbound', senderAddress: victim.userPrincipalName, spfResult: 'pass', dkimResult: 'pass', dmarcResult: 'pass' },
      'victim.personal123@gmail.com',
    );
    const att = attachment(msg.id);

    const candidates = evaluateOutboundPersonalEmailRule([msg], [att]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toEqual([{ eventTable: 'email_messages', eventId: msg.id }]);
  });

  it('does not fire on an outbound message with no attachment', () => {
    const victim = identity();
    const msg = email({ direction: 'outbound' }, 'victim.personal123@gmail.com');
    expect(evaluateOutboundPersonalEmailRule([msg], [])).toHaveLength(0);
  });

  it('does not fire on an inbound message to a personal-looking address', () => {
    const victim = identity();
    const msg = email({ direction: 'inbound' }, 'victim.personal123@gmail.com');
    const att = attachment(msg.id);
    expect(evaluateOutboundPersonalEmailRule([msg], [att])).toHaveLength(0);
  });

  it('does not fire on an outbound message with an attachment sent to an organizational address', () => {
    const victim = identity();
    const msg = email({ direction: 'outbound' }, 'colleague@contoso-finance.example.com');
    const att = attachment(msg.id);
    expect(evaluateOutboundPersonalEmailRule([msg], [att])).toHaveLength(0);
  });
});

describe('evaluateSuspiciousProcessRule (§8.2, §10.3)', () => {
  it('fires when an Office app is the direct parent of a script interpreter', () => {
    const dev = device();
    const parentGuid = randomUUID();
    const parent = processEvent(dev.id, {
      processGuid: parentGuid,
      imagePath: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    });
    const child = processEvent(dev.id, {
      parentProcessGuid: parentGuid,
      imagePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      commandLine: 'powershell.exe -EncodedCommand abcd',
    });

    const candidates = evaluateSuspiciousProcessRule([parent, child], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].primaryEntityId).toBe(dev.id);
    expect(candidates[0].evidenceRefs).toHaveLength(2);
  });

  it('does not fire for an ordinary, unrelated parent-child pair', () => {
    const dev = device();
    const parentGuid = randomUUID();
    const parent = processEvent(dev.id, { processGuid: parentGuid, imagePath: 'C:\\Windows\\explorer.exe' });
    const child = processEvent(dev.id, { parentProcessGuid: parentGuid, imagePath: 'C:\\Windows\\System32\\notepad.exe' });

    expect(evaluateSuspiciousProcessRule([parent, child], [dev])).toHaveLength(0);
  });

  it('does not fire when a script interpreter has no matching parent in the dataset', () => {
    const dev = device();
    const orphanChild = processEvent(dev.id, {
      parentProcessGuid: randomUUID(), // no process in the dataset has this guid
      imagePath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    });
    expect(evaluateSuspiciousProcessRule([orphanChild], [dev])).toHaveLength(0);
  });

  it('does not fire when an Office app spawns another ordinary process (not a script interpreter)', () => {
    const dev = device();
    const parentGuid = randomUUID();
    const parent = processEvent(dev.id, { processGuid: parentGuid, imagePath: 'C:\\...\\EXCEL.EXE' });
    const child = processEvent(dev.id, { parentProcessGuid: parentGuid, imagePath: 'C:\\Windows\\System32\\notepad.exe' });

    expect(evaluateSuspiciousProcessRule([parent, child], [dev])).toHaveLength(0);
  });
});

describe('correlateCandidates (§8.3)', () => {
  it('links candidates that share a correlation_id', () => {
    const sharedCorrelationId = randomUUID();
    const victim = identity();
    const maliciousEmail = email({ correlationId: sharedCorrelationId }, victim.userPrincipalName);
    const riskySignIn = signIn(victim.id, { correlationId: sharedCorrelationId });

    const emailCandidates = evaluateSpfFailRule([maliciousEmail], [victim]);
    const signInCandidates = evaluateNewCountryRule([riskySignIn], [victim]);
    const links = correlateCandidates([...emailCandidates, ...signInCandidates]);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual([emailCandidates[0].id, signInCandidates[0].id]);
  });

  it('does not link candidates with no correlation_id', () => {
    const victim = identity();
    const email1 = email({ correlationId: null }, victim.userPrincipalName);
    const candidates = evaluateSpfFailRule([email1], [victim]);
    expect(correlateCandidates(candidates)).toHaveLength(0);
  });
});
