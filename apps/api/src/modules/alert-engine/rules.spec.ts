import { randomUUID } from 'crypto';
import type { EmailMessage, Identity, SignInEvent } from '@prisma/client';
import { correlateCandidates, evaluateNewCountryRule, evaluateSpfFailRule } from './rules';

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
