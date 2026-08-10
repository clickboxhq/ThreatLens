import { randomUUID } from 'crypto';
import type {
  CloudEvent,
  Device,
  EmailAttachment,
  EmailMessage,
  FileEvent,
  HttpRequest,
  Identity,
  NetworkEvent,
  ProcessEvent,
  SignInEvent,
} from '@prisma/client';
import {
  correlateCandidates,
  evaluateCredentialDumpingRule,
  evaluateDnsTunnelingRule,
  evaluateImpossibleTravelRule,
  evaluateKerberoastingRule,
  evaluateLateralMovementRule,
  evaluateLegacyAuthBypassRule,
  evaluateMassEncryptionRule,
  evaluateMfaFatigueRule,
  evaluateNewCountryRule,
  evaluateOAuthConsentGrantRule,
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
    ...overrides,
  } as Identity;
}

function email(
  overrides: Partial<EmailMessage> = {},
  recipientUpn: string,
): EmailMessage {
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

function signIn(
  identityId: string,
  overrides: Partial<SignInEvent> = {},
): SignInEvent {
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

function processEvent(
  deviceId: string,
  overrides: Partial<ProcessEvent> = {},
): ProcessEvent {
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

function fileEvent(
  deviceId: string,
  overrides: Partial<FileEvent> = {},
): FileEvent {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    deviceId,
    action: 'created',
    filePath: 'C:\\Shares\\Finance\\report.xlsx',
    hashSha256: 'a'.repeat(64),
    processGuid: null,
    ...overrides,
  } as FileEvent;
}

function cloudEvent(
  identityId: string,
  overrides: Partial<CloudEvent> = {},
): CloudEvent {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    identityId,
    provider: 'aws_style',
    actionName: 'CreateAccessKey',
    resourceId: null,
    sourceIp: '203.0.113.10',
    ...overrides,
  } as CloudEvent;
}

function networkEvent(
  deviceId: string,
  overrides: Partial<NetworkEvent> = {},
): NetworkEvent {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    deviceId,
    direction: 'outbound',
    protocol: 'tcp',
    localPort: 51000,
    remoteIp: '203.0.113.10',
    remotePort: 443,
    bytesSent: 500,
    bytesReceived: 300,
    processGuid: null,
    ...overrides,
  } as NetworkEvent;
}

function httpRequest(
  deviceId: string,
  overrides: Partial<HttpRequest> = {},
): HttpRequest {
  return {
    id: randomUUID(),
    sessionId: randomUUID(),
    occurredAt: new Date(),
    correlationId: null,
    raw: {},
    isGroundTruthEvidence: true,
    mitreTechniqueId: null,
    deviceId,
    identityId: null,
    method: 'GET',
    url: '/uploads/images/x7f2a9c.php',
    userAgent: 'curl/7.88.1',
    statusCode: 200,
    sourceIp: '203.0.113.10',
    ...overrides,
  } as HttpRequest;
}

function attachment(
  emailMessageId: string,
  overrides: Partial<EmailAttachment> = {},
): EmailAttachment {
  return {
    id: randomUUID(),
    emailMessageId,
    filename: 'Q3_Customer_Contracts_Export.xlsx',
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 48213,
    hashSha256: 'a'.repeat(64),
    sandboxVerdict: 'benign',
    ...overrides,
  } as EmailAttachment;
}

describe('evaluateSpfFailRule (§8.2)', () => {
  it('fires on an inbound SPF-fail email, including a benign one (§8.6)', () => {
    const victim = identity();
    const maliciousEmail = email(
      { isGroundTruthEvidence: true },
      victim.userPrincipalName,
    );
    const benignEmail = email(
      {
        isGroundTruthEvidence: false,
        senderAddress: 'it@contoso-finance-support.example.com',
        subject: 'Maintenance',
      },
      victim.userPrincipalName,
    );

    const candidates = evaluateSpfFailRule(
      [maliciousEmail, benignEmail],
      [victim],
    );
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
    const riskySignIn = signIn(victim.id, {
      sourceCountry: 'RO',
      isGroundTruthEvidence: true,
    });
    const travelSignIn = signIn(victim.id, {
      sourceCountry: 'FR',
      isGroundTruthEvidence: false,
    });
    const baselineSignIn = signIn(victim.id, { sourceCountry: 'US' });

    const candidates = evaluateNewCountryRule(
      [riskySignIn, travelSignIn, baselineSignIn],
      [victim],
    );
    expect(candidates).toHaveLength(2);
  });

  it('does not fire on a failed sign-in', () => {
    const victim = identity();
    const failed = signIn(victim.id, {
      sourceCountry: 'RO',
      result: 'failure',
    });
    expect(evaluateNewCountryRule([failed], [victim])).toHaveLength(0);
  });
});

describe('evaluatePasswordSprayRule (§8.2)', () => {
  it('fires once for a source IP with failed attempts against >= 5 distinct identities, citing every event', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 6 }, () => identity());
    const failedAttempts = targets.map((t) =>
      signIn(t.id, { sourceIp: attackerIp, result: 'failure' }),
    );
    const unrelatedBaseline = signIn(targets[0].id, {
      sourceIp: '10.0.0.1',
      result: 'success',
      sourceCountry: 'US',
    });

    const candidates = evaluatePasswordSprayRule(
      [...failedAttempts, unrelatedBaseline],
      targets,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
    expect(candidates[0].evidenceRefs.map((r) => r.eventId).sort()).toEqual(
      failedAttempts.map((e) => e.id).sort(),
    );
  });

  it('does not fire below the distinct-identity threshold', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 4 }, () => identity());
    const failedAttempts = targets.map((t) =>
      signIn(t.id, { sourceIp: attackerIp, result: 'failure' }),
    );

    expect(evaluatePasswordSprayRule(failedAttempts, targets)).toHaveLength(0);
  });

  it('names the compromised identity and includes the success event when the spray succeeded', () => {
    const attackerIp = '198.51.100.7';
    const targets = Array.from({ length: 5 }, () => identity());
    const failedAttempts = targets.map((t) =>
      signIn(t.id, { sourceIp: attackerIp, result: 'failure' }),
    );
    const compromised = targets[2];
    const successEvent = signIn(compromised.id, {
      sourceIp: attackerIp,
      result: 'success',
      sourceCountry: 'RO',
    });

    const candidates = evaluatePasswordSprayRule(
      [...failedAttempts, successEvent],
      targets,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityId).toBe(compromised.id);
    expect(candidates[0].title).toContain(compromised.displayName);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('does not conflate failed attempts from different source IPs', () => {
    const targets = Array.from({ length: 10 }, () => identity());
    const fromIpA = targets
      .slice(0, 3)
      .map((t) =>
        signIn(t.id, { sourceIp: '198.51.100.1', result: 'failure' }),
      );
    const fromIpB = targets
      .slice(3, 6)
      .map((t) =>
        signIn(t.id, { sourceIp: '198.51.100.2', result: 'failure' }),
      );

    expect(
      evaluatePasswordSprayRule([...fromIpA, ...fromIpB], targets),
    ).toHaveLength(0);
  });
});

describe('evaluateMfaFatigueRule (§8.2)', () => {
  it('fires when one identity gets >= 5 mfa_denied results from one IP', () => {
    const victim = identity();
    const attackerIp = '198.51.100.20';
    const denials = Array.from({ length: 6 }, () =>
      signIn(victim.id, { sourceIp: attackerIp, result: 'mfa_denied' }),
    );

    const candidates = evaluateMfaFatigueRule(denials, [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityId).toBe(victim.id);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('includes the eventual success in evidence and names it in the title', () => {
    const victim = identity();
    const attackerIp = '198.51.100.20';
    const denials = Array.from({ length: 5 }, () =>
      signIn(victim.id, { sourceIp: attackerIp, result: 'mfa_denied' }),
    );
    const success = signIn(victim.id, {
      sourceIp: attackerIp,
      result: 'success',
    });

    const candidates = evaluateMfaFatigueRule([...denials, success], [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
    expect(candidates[0].title).toContain(victim.displayName);
  });

  it('does not fire below the denial threshold', () => {
    const victim = identity();
    const denials = Array.from({ length: 4 }, () =>
      signIn(victim.id, { sourceIp: '198.51.100.20', result: 'mfa_denied' }),
    );
    expect(evaluateMfaFatigueRule(denials, [victim])).toHaveLength(0);
  });

  it('does not conflate denials against different identities from the same IP (that is password spray, not MFA fatigue)', () => {
    const targets = Array.from({ length: 6 }, () => identity());
    const denials = targets.map((t) =>
      signIn(t.id, { sourceIp: '198.51.100.20', result: 'mfa_denied' }),
    );
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
    expect(candidates[0].evidenceRefs.map((r) => r.eventId).sort()).toEqual(
      [first.id, second.id].sort(),
    );
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

    expect(
      evaluateImpossibleTravelRule([first, second], [victim]),
    ).toHaveLength(0);
  });

  it('ignores failed sign-ins entirely', () => {
    const victim = identity();
    const first = signIn(victim.id, {
      sourceCity: 'Chicago',
      result: 'failure',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
    });
    const second = signIn(victim.id, {
      sourceCity: 'Tokyo',
      result: 'failure',
      occurredAt: new Date('2026-01-01T10:45:00Z'),
    });
    expect(
      evaluateImpossibleTravelRule([first, second], [victim]),
    ).toHaveLength(0);
  });

  it('does not fire for consecutive sign-ins from the same city', () => {
    const victim = identity();
    const first = signIn(victim.id, {
      sourceCity: 'Chicago',
      occurredAt: new Date('2026-01-01T10:00:00Z'),
    });
    const second = signIn(victim.id, {
      sourceCity: 'Chicago',
      occurredAt: new Date('2026-01-01T10:05:00Z'),
    });
    expect(
      evaluateImpossibleTravelRule([first, second], [victim]),
    ).toHaveLength(0);
  });
});

describe('evaluateOutboundPersonalEmailRule (§8.2)', () => {
  it('fires on an outbound message with an attachment sent to a personal webmail address', () => {
    const victim = identity();
    const msg = email(
      {
        direction: 'outbound',
        senderAddress: victim.userPrincipalName,
        spfResult: 'pass',
        dkimResult: 'pass',
        dmarcResult: 'pass',
      },
      'victim.personal123@gmail.com',
    );
    const att = attachment(msg.id);

    const candidates = evaluateOutboundPersonalEmailRule([msg], [att]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'email_messages', eventId: msg.id },
    ]);
  });

  it('does not fire on an outbound message with no attachment', () => {
    const msg = email(
      { direction: 'outbound' },
      'victim.personal123@gmail.com',
    );
    expect(evaluateOutboundPersonalEmailRule([msg], [])).toHaveLength(0);
  });

  it('does not fire on an inbound message to a personal-looking address', () => {
    const msg = email({ direction: 'inbound' }, 'victim.personal123@gmail.com');
    const att = attachment(msg.id);
    expect(evaluateOutboundPersonalEmailRule([msg], [att])).toHaveLength(0);
  });

  it('does not fire on an outbound message with an attachment sent to an organizational address', () => {
    const msg = email(
      { direction: 'outbound' },
      'colleague@contoso-finance.example.com',
    );
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
      imagePath:
        'C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE',
    });
    const child = processEvent(dev.id, {
      parentProcessGuid: parentGuid,
      imagePath:
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
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
    const parent = processEvent(dev.id, {
      processGuid: parentGuid,
      imagePath: 'C:\\Windows\\explorer.exe',
    });
    const child = processEvent(dev.id, {
      parentProcessGuid: parentGuid,
      imagePath: 'C:\\Windows\\System32\\notepad.exe',
    });

    expect(evaluateSuspiciousProcessRule([parent, child], [dev])).toHaveLength(
      0,
    );
  });

  it('does not fire when a script interpreter has no matching parent in the dataset', () => {
    const dev = device();
    const orphanChild = processEvent(dev.id, {
      parentProcessGuid: randomUUID(), // no process in the dataset has this guid
      imagePath:
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    });
    expect(evaluateSuspiciousProcessRule([orphanChild], [dev])).toHaveLength(0);
  });

  it('does not fire when an Office app spawns another ordinary process (not a script interpreter)', () => {
    const dev = device();
    const parentGuid = randomUUID();
    const parent = processEvent(dev.id, {
      processGuid: parentGuid,
      imagePath: 'C:\\...\\EXCEL.EXE',
    });
    const child = processEvent(dev.id, {
      parentProcessGuid: parentGuid,
      imagePath: 'C:\\Windows\\System32\\notepad.exe',
    });

    expect(evaluateSuspiciousProcessRule([parent, child], [dev])).toHaveLength(
      0,
    );
  });
});

describe('evaluateLateralMovementRule (§8.2, §10.3)', () => {
  it('fires when PSEXESVC.exe appears, citing the parent and any children it spawned', () => {
    const dev = device();
    const scmGuid = randomUUID();
    const psexecGuid = randomUUID();
    const scm = processEvent(dev.id, {
      processGuid: scmGuid,
      imagePath: 'C:\\Windows\\System32\\services.exe',
    });
    const psexecsvc = processEvent(dev.id, {
      processGuid: psexecGuid,
      parentProcessGuid: scmGuid,
      imagePath: 'C:\\Windows\\PSEXESVC.exe',
    });
    const remoteCmd = processEvent(dev.id, {
      parentProcessGuid: psexecGuid,
      imagePath: 'C:\\Windows\\System32\\cmd.exe',
      commandLine: 'cmd.exe /c whoami',
    });

    const candidates = evaluateLateralMovementRule(
      [scm, psexecsvc, remoteCmd],
      [dev],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].primaryEntityId).toBe(dev.id);
    expect(candidates[0].evidenceRefs).toHaveLength(3);
  });

  it('does not fire when no PSEXESVC.exe process exists', () => {
    const dev = device();
    const ordinary = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\notepad.exe',
    });
    expect(evaluateLateralMovementRule([ordinary], [dev])).toHaveLength(0);
  });
});

describe('evaluateMassEncryptionRule (§8.2, §10.5)', () => {
  it('fires once for a device with >= 5 encrypted files within the window, citing every file', () => {
    const dev = device();
    const base = new Date();
    const events = Array.from({ length: 6 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'encrypted',
        occurredAt: new Date(base.getTime() + i * 20 * 1000),
      }),
    );

    const candidates = evaluateMassEncryptionRule(events, [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('does not fire below the threshold', () => {
    const dev = device();
    const events = Array.from({ length: 3 }, () =>
      fileEvent(dev.id, { action: 'encrypted' }),
    );
    expect(evaluateMassEncryptionRule(events, [dev])).toHaveLength(0);
  });

  it('does not fire when files are merely created, not encrypted', () => {
    const dev = device();
    const events = Array.from({ length: 6 }, () =>
      fileEvent(dev.id, { action: 'created' }),
    );
    expect(evaluateMassEncryptionRule(events, [dev])).toHaveLength(0);
  });

  it('does not count encrypted files outside the rolling window toward the same cluster', () => {
    const dev = device();
    const base = new Date();
    const cluster = Array.from({ length: 4 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'encrypted',
        occurredAt: new Date(base.getTime() + i * 20 * 1000),
      }),
    );
    const farLater = fileEvent(dev.id, {
      action: 'encrypted',
      occurredAt: new Date(base.getTime() + 60 * 60 * 1000),
    });
    expect(
      evaluateMassEncryptionRule([...cluster, farLater], [dev]),
    ).toHaveLength(0);
  });
});

describe('evaluateLegacyAuthBypassRule (§8.2, §9)', () => {
  it('fires on a successful legacy-auth sign-in for an MFA-enforced identity', () => {
    const victim = identity({ mfaStatus: 'enforced' });
    const bypass = signIn(victim.id, {
      isLegacyAuth: true,
      result: 'success',
      clientApp: 'IMAP4',
    });

    const candidates = evaluateLegacyAuthBypassRule([bypass], [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityId).toBe(victim.id);
    expect(candidates[0].evidenceRefs).toHaveLength(1);
  });

  it('groups multiple legacy-auth successes for the same identity into one alert', () => {
    const victim = identity({ mfaStatus: 'enforced' });
    const events = Array.from({ length: 5 }, () =>
      signIn(victim.id, { isLegacyAuth: true, result: 'success' }),
    );

    const candidates = evaluateLegacyAuthBypassRule(events, [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(5);
  });

  it('does not fire when MFA is not enforced on the identity', () => {
    const victim = identity({ mfaStatus: 'registered_not_enforced' });
    const legacySignIn = signIn(victim.id, {
      isLegacyAuth: true,
      result: 'success',
    });
    expect(evaluateLegacyAuthBypassRule([legacySignIn], [victim])).toHaveLength(
      0,
    );
  });

  it('does not fire on a modern-auth sign-in even on an MFA-enforced identity', () => {
    const victim = identity({ mfaStatus: 'enforced' });
    const modernSignIn = signIn(victim.id, {
      isLegacyAuth: false,
      result: 'success',
    });
    expect(evaluateLegacyAuthBypassRule([modernSignIn], [victim])).toHaveLength(
      0,
    );
  });

  it('does not fire on a failed legacy-auth attempt', () => {
    const victim = identity({ mfaStatus: 'enforced' });
    const failedLegacy = signIn(victim.id, {
      isLegacyAuth: true,
      result: 'failure',
    });
    expect(evaluateLegacyAuthBypassRule([failedLegacy], [victim])).toHaveLength(
      0,
    );
  });
});

describe('evaluateSuspiciousCloudActionRule (§8.2)', () => {
  it('fires on a sensitive cloud action', () => {
    const victim = identity();
    const event = cloudEvent(victim.id, { actionName: 'CreateAccessKey' });

    const candidates = evaluateSuspiciousCloudActionRule([event], [victim]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('identity');
    expect(candidates[0].primaryEntityId).toBe(victim.id);
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'cloud_events', eventId: event.id },
    ]);
  });

  it('does not fire on an ordinary, non-sensitive cloud action', () => {
    const victim = identity();
    const event = cloudEvent(victim.id, { actionName: 'ListBucket' });
    expect(evaluateSuspiciousCloudActionRule([event], [victim])).toHaveLength(
      0,
    );
  });

  it('fires once per matching event, even from a benign identity (§8.6)', () => {
    const victim = identity();
    const event = cloudEvent(victim.id, {
      actionName: 'PutBucketPolicy',
      isGroundTruthEvidence: false,
    });
    expect(evaluateSuspiciousCloudActionRule([event], [victim])).toHaveLength(
      1,
    );
  });
});

describe('evaluateWebShellAccessRule (§8.2, §10.3)', () => {
  it('groups repeated non-browser requests to the same script path on a device into one alert', () => {
    const dev = device({ hostname: 'WEB-PROD-01', osPlatform: 'linux' });
    const initial = httpRequest(dev.id, {
      method: 'GET',
      userAgent: 'Wget/1.21.3',
    });
    const burst = Array.from({ length: 5 }, () =>
      httpRequest(dev.id, { method: 'POST', userAgent: 'curl/7.88.1' }),
    );

    const candidates = evaluateWebShellAccessRule([initial, ...burst], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].primaryEntityId).toBe(dev.id);
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('does not fire for a browser client on the same path', () => {
    const dev = device();
    const event = httpRequest(dev.id, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    expect(evaluateWebShellAccessRule([event], [dev])).toHaveLength(0);
  });

  it('does not fire for a non-browser client on a non-script path', () => {
    const dev = device();
    const event = httpRequest(dev.id, { url: '/images/logo.png' });
    expect(evaluateWebShellAccessRule([event], [dev])).toHaveLength(0);
  });

  it('fires for the same non-browser-client + script-path heuristic on legitimate monitoring traffic (§8.6)', () => {
    const dev = device();
    const monitoring = httpRequest(dev.id, {
      method: 'GET',
      url: '/api/health-check.php',
      userAgent: 'curl/7.88.1',
      isGroundTruthEvidence: false,
    });
    expect(evaluateWebShellAccessRule([monitoring], [dev])).toHaveLength(1);
  });

  it('keeps separate script paths on the same device as separate alerts', () => {
    const dev = device();
    const webshell = httpRequest(dev.id, {
      url: '/uploads/images/x7f2a9c.php',
    });
    const monitoring = httpRequest(dev.id, { url: '/api/health-check.php' });

    const candidates = evaluateWebShellAccessRule(
      [webshell, monitoring],
      [dev],
    );
    expect(candidates).toHaveLength(2);
  });

  it('ignores requests with no device association', () => {
    const event = httpRequest('', { deviceId: null });
    expect(evaluateWebShellAccessRule([event], [])).toHaveLength(0);
  });
});

describe('evaluatePersistenceArtifactRule (§8.2)', () => {
  it('fires when a file is created in a Startup-folder location', () => {
    const dev = device();
    const artifact = fileEvent(dev.id, {
      action: 'created',
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\WinSvcHelper.lnk',
    });

    const candidates = evaluatePersistenceArtifactRule([artifact], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].primaryEntityId).toBe(dev.id);
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'file_events', eventId: artifact.id },
    ]);
  });

  it('fires on a legitimate startup shortcut too, even from a benign origin (§8.6)', () => {
    const dev = device();
    const legit = fileEvent(dev.id, {
      action: 'created',
      isGroundTruthEvidence: false,
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\OneDrive.lnk',
    });
    expect(evaluatePersistenceArtifactRule([legit], [dev])).toHaveLength(1);
  });

  it('does not fire for a file created outside a Startup-folder location', () => {
    const dev = device();
    const ordinary = fileEvent(dev.id, {
      action: 'created',
      filePath: 'C:\\Shares\\Finance\\report.xlsx',
    });
    expect(evaluatePersistenceArtifactRule([ordinary], [dev])).toHaveLength(0);
  });

  it('does not fire for a non-create action in a Startup-folder location', () => {
    const dev = device();
    const deleted = fileEvent(dev.id, {
      action: 'deleted',
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\old.lnk',
    });
    expect(evaluatePersistenceArtifactRule([deleted], [dev])).toHaveLength(0);
  });

  it('fires once per matching file, keeping separate startup artifacts as separate alerts', () => {
    const dev = device();
    const real = fileEvent(dev.id, {
      action: 'created',
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\WinSvcHelper.lnk',
    });
    const bait1 = fileEvent(dev.id, {
      action: 'created',
      isGroundTruthEvidence: false,
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\OneDrive.lnk',
    });
    const bait2 = fileEvent(dev.id, {
      action: 'created',
      isGroundTruthEvidence: false,
      filePath:
        'C:\\Users\\Public\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\OneDrive.lnk',
    });

    const candidates = evaluatePersistenceArtifactRule(
      [real, bait1, bait2],
      [dev],
    );
    expect(candidates).toHaveLength(3);
  });
});

describe('correlateCandidates (§8.3)', () => {
  it('links candidates that share a correlation_id', () => {
    const sharedCorrelationId = randomUUID();
    const victim = identity();
    const maliciousEmail = email(
      { correlationId: sharedCorrelationId },
      victim.userPrincipalName,
    );
    const riskySignIn = signIn(victim.id, {
      correlationId: sharedCorrelationId,
    });

    const emailCandidates = evaluateSpfFailRule([maliciousEmail], [victim]);
    const signInCandidates = evaluateNewCountryRule([riskySignIn], [victim]);
    const links = correlateCandidates([
      ...emailCandidates,
      ...signInCandidates,
    ]);

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

describe('evaluateCredentialDumpingRule (§8.2)', () => {
  it('fires when a command line references both comsvcs.dll and MiniDump', () => {
    const dev = device();
    const dump = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\rundll32.exe',
      commandLine:
        'rundll32.exe C:\\Windows\\System32\\comsvcs.dll, MiniDump 812 C:\\Windows\\Temp\\lsass_dbg.dmp full',
    });

    const candidates = evaluateCredentialDumpingRule([dump], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].primaryEntityId).toBe(dev.id);
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'process_events', eventId: dump.id },
    ]);
  });

  it('is case-insensitive on the command-line markers', () => {
    const dev = device();
    const dump = processEvent(dev.id, {
      commandLine: 'RUNDLL32.EXE COMSVCS.DLL, MINIDUMP 812 C:\\dump.dmp FULL',
    });
    expect(evaluateCredentialDumpingRule([dump], [dev])).toHaveLength(1);
  });

  it('does not fire for an unrelated rundll32 invocation', () => {
    const dev = device();
    const benign = processEvent(dev.id, {
      commandLine: 'rundll32.exe shell32.dll,Control_RunDLL',
    });
    expect(evaluateCredentialDumpingRule([benign], [dev])).toHaveLength(0);
  });

  it('does not fire when only one of the two markers is present', () => {
    const dev = device();
    const partial = processEvent(dev.id, {
      commandLine: 'rundll32.exe comsvcs.dll, SomeOtherExport',
    });
    expect(evaluateCredentialDumpingRule([partial], [dev])).toHaveLength(0);
  });
});

describe('evaluateRemovableMediaCopyRule (§8.2)', () => {
  it('fires once a device accumulates >= 5 file-created events on a removable drive within the window', () => {
    const dev = device();
    const copies = Array.from({ length: 5 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'created',
        filePath: `E:\\Backup\\file${i}.xlsx`,
        occurredAt: new Date(Date.now() + i * 1000),
      }),
    );

    const candidates = evaluateRemovableMediaCopyRule(copies, [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toHaveLength(5);
  });

  it('does not fire below the threshold', () => {
    const dev = device();
    const copies = Array.from({ length: 4 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'created',
        filePath: `E:\\Backup\\file${i}.xlsx`,
      }),
    );
    expect(evaluateRemovableMediaCopyRule(copies, [dev])).toHaveLength(0);
  });

  it('ignores non-removable-drive paths even in high volume', () => {
    const dev = device();
    const copies = Array.from({ length: 6 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'created',
        filePath: `C:\\Shares\\Finance\\file${i}.xlsx`,
      }),
    );
    expect(evaluateRemovableMediaCopyRule(copies, [dev])).toHaveLength(0);
  });

  it('ignores non-create actions on a removable drive', () => {
    const dev = device();
    const deletions = Array.from({ length: 6 }, (_, i) =>
      fileEvent(dev.id, {
        action: 'deleted',
        filePath: `E:\\Backup\\file${i}.xlsx`,
      }),
    );
    expect(evaluateRemovableMediaCopyRule(deletions, [dev])).toHaveLength(0);
  });
});

describe('evaluateSqlInjectionRule (§8.2)', () => {
  it('fires on a boolean-tautology SQLi payload in the URL', () => {
    const dev = device();
    const probe = httpRequest(dev.id, {
      url: "/api/customers?id=1' OR '1'='1",
      userAgent: 'python-requests/2.31.0',
    });

    const candidates = evaluateSqlInjectionRule([probe], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'http_requests', eventId: probe.id },
    ]);
  });

  it('fires on a UNION SELECT payload', () => {
    const dev = device();
    const exfil = httpRequest(dev.id, {
      url: '/api/customers?id=1%27%20UNION%20SELECT%20username,password_hash%20FROM%20customers--',
    });
    expect(evaluateSqlInjectionRule([exfil], [dev])).toHaveLength(1);
  });

  it('does not fire on an ordinary request', () => {
    const dev = device();
    const ordinary = httpRequest(dev.id, { url: '/api/customers?id=42' });
    expect(evaluateSqlInjectionRule([ordinary], [dev])).toHaveLength(0);
  });

  it('groups every matching request on the same device into one alert', () => {
    const dev = device();
    const probe1 = httpRequest(dev.id, {
      url: "/api/customers?id=1' OR '1'='1",
    });
    const probe2 = httpRequest(dev.id, {
      url: "/api/customers?id=1' OR SLEEP(5)--",
    });
    const exfil = httpRequest(dev.id, {
      url: '/api/customers?id=1%27%20UNION%20SELECT%20x--',
    });

    const candidates = evaluateSqlInjectionRule([probe1, probe2, exfil], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidenceRefs).toHaveLength(3);
  });

  it('ignores requests with no device association', () => {
    const request = httpRequest('', { deviceId: null, url: "1' OR '1'='1" });
    expect(evaluateSqlInjectionRule([request], [])).toHaveLength(0);
  });
});

describe('evaluateScheduledTaskPersistenceRule (§8.2)', () => {
  it('fires when schtasks.exe runs with a /create argument', () => {
    const dev = device();
    const task = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\schtasks.exe',
      commandLine:
        'schtasks.exe /create /tn "MicrosoftEdgeUpdateTaskMachine" /tr "C:\\svc_helper.exe" /sc onlogon /ru SYSTEM',
    });

    const candidates = evaluateScheduledTaskPersistenceRule([task], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'process_events', eventId: task.id },
    ]);
  });

  it('does not fire for schtasks.exe queries or deletions', () => {
    const dev = device();
    const query = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\schtasks.exe',
      commandLine: 'schtasks.exe /query',
    });
    const deletion = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\schtasks.exe',
      commandLine: 'schtasks.exe /delete /tn "Foo"',
    });
    expect(
      evaluateScheduledTaskPersistenceRule([query, deletion], [dev]),
    ).toHaveLength(0);
  });

  it('does not fire for an unrelated process with /create in its command line', () => {
    const dev = device();
    const unrelated = processEvent(dev.id, {
      imagePath: 'C:\\Windows\\System32\\notepad.exe',
      commandLine: 'notepad.exe /create',
    });
    expect(
      evaluateScheduledTaskPersistenceRule([unrelated], [dev]),
    ).toHaveLength(0);
  });
});

describe('evaluateOAuthConsentGrantRule (§8.2)', () => {
  it('fires when a consent grant is followed by >= 3 mailbox-access actions from the same app within the window', () => {
    const victim = identity();
    const consent = cloudEvent(victim.id, {
      provider: 'saas',
      actionName: 'ConsentToApplication',
      resourceId: 'Office Sync Helper',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    });
    const mailAccess = Array.from({ length: 5 }, (_, i) =>
      cloudEvent(victim.id, {
        provider: 'saas',
        actionName: 'MailItemsAccessed',
        resourceId: 'Office Sync Helper',
        occurredAt: new Date(
          consent.occurredAt.getTime() + (i + 1) * 20 * 1000,
        ),
      }),
    );

    const candidates = evaluateOAuthConsentGrantRule(
      [consent, ...mailAccess],
      [victim],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('identity');
    expect(candidates[0].evidenceRefs).toHaveLength(6);
  });

  it('does not fire below the mailbox-access threshold', () => {
    const victim = identity();
    const consent = cloudEvent(victim.id, {
      actionName: 'ConsentToApplication',
      resourceId: 'Office Sync Helper',
    });
    const mailAccess = Array.from({ length: 2 }, () =>
      cloudEvent(victim.id, {
        actionName: 'MailItemsAccessed',
        resourceId: 'Office Sync Helper',
      }),
    );
    expect(
      evaluateOAuthConsentGrantRule([consent, ...mailAccess], [victim]),
    ).toHaveLength(0);
  });

  it('does not fire for mailbox access from a different app than the one consented to', () => {
    const victim = identity();
    const consent = cloudEvent(victim.id, {
      actionName: 'ConsentToApplication',
      resourceId: 'Office Sync Helper',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    });
    const unrelatedAccess = Array.from({ length: 5 }, (_, i) =>
      cloudEvent(victim.id, {
        actionName: 'MailItemsAccessed',
        resourceId: 'Some Other App',
        occurredAt: new Date(
          consent.occurredAt.getTime() + (i + 1) * 20 * 1000,
        ),
      }),
    );
    expect(
      evaluateOAuthConsentGrantRule([consent, ...unrelatedAccess], [victim]),
    ).toHaveLength(0);
  });

  it('does not fire for mailbox access outside the correlation window', () => {
    const victim = identity();
    const consent = cloudEvent(victim.id, {
      actionName: 'ConsentToApplication',
      resourceId: 'Office Sync Helper',
      occurredAt: new Date('2026-01-01T00:00:00Z'),
    });
    const lateAccess = Array.from({ length: 5 }, (_, i) =>
      cloudEvent(victim.id, {
        actionName: 'MailItemsAccessed',
        resourceId: 'Office Sync Helper',
        occurredAt: new Date(
          consent.occurredAt.getTime() + 60 * 60 * 1000 + i * 1000,
        ),
      }),
    );
    expect(
      evaluateOAuthConsentGrantRule([consent, ...lateAccess], [victim]),
    ).toHaveLength(0);
  });
});

describe('evaluateKerberoastingRule (§8.2)', () => {
  it('fires when a command line references Rubeus', () => {
    const dev = device();
    const ticketRequest = processEvent(dev.id, {
      imagePath: 'C:\\Users\\Public\\Downloads\\Rubeus.exe',
      commandLine:
        'Rubeus.exe kerberoast /outfile:C:\\Windows\\Temp\\svc_hashes.txt /format:hashcat',
    });

    const candidates = evaluateKerberoastingRule([ticketRequest], [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toEqual([
      { eventTable: 'process_events', eventId: ticketRequest.id },
    ]);
  });

  it('is case-insensitive on the command-line marker', () => {
    const dev = device();
    const ticketRequest = processEvent(dev.id, {
      commandLine:
        'Get-DomainSPNTicket -SPN HTTP/webapp -OutputFormat KERBEROAST',
    });
    expect(evaluateKerberoastingRule([ticketRequest], [dev])).toHaveLength(1);
  });

  it('does not fire for an unrelated process', () => {
    const dev = device();
    const benign = processEvent(dev.id, { commandLine: 'notepad.exe' });
    expect(evaluateKerberoastingRule([benign], [dev])).toHaveLength(0);
  });
});

describe('evaluateDnsTunnelingRule (§8.2)', () => {
  it('fires once a device accumulates >= 8 DNS-port events to the same remote address', () => {
    const dev = device();
    const queries = Array.from({ length: 8 }, (_, i) =>
      networkEvent(dev.id, {
        remoteIp: '91.219.237.14',
        remotePort: 53,
        protocol: 'udp',
        occurredAt: new Date(Date.now() + i * 1000),
      }),
    );

    const candidates = evaluateDnsTunnelingRule(queries, [dev]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].primaryEntityType).toBe('device');
    expect(candidates[0].evidenceRefs).toHaveLength(8);
  });

  it('does not fire below the query-count threshold', () => {
    const dev = device();
    const queries = Array.from({ length: 7 }, () =>
      networkEvent(dev.id, { remoteIp: '91.219.237.14', remotePort: 53 }),
    );
    expect(evaluateDnsTunnelingRule(queries, [dev])).toHaveLength(0);
  });

  it('ignores non-DNS-port traffic even in high volume', () => {
    const dev = device();
    const traffic = Array.from({ length: 10 }, () =>
      networkEvent(dev.id, { remoteIp: '185.220.101.47', remotePort: 443 }),
    );
    expect(evaluateDnsTunnelingRule(traffic, [dev])).toHaveLength(0);
  });

  it('does not merge DNS queries to different remote addresses into one alert', () => {
    const dev = device();
    const toFirst = Array.from({ length: 4 }, () =>
      networkEvent(dev.id, { remoteIp: '91.219.237.14', remotePort: 53 }),
    );
    const toSecond = Array.from({ length: 4 }, () =>
      networkEvent(dev.id, { remoteIp: '198.51.100.20', remotePort: 53 }),
    );
    expect(
      evaluateDnsTunnelingRule([...toFirst, ...toSecond], [dev]),
    ).toHaveLength(0);
  });
});
