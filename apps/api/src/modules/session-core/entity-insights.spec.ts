import {
  computeIdentityInsights,
  computeDeviceInsights,
  computeEmailInsights,
} from './entity-insights';
import type { EntityInsight, IdentityInsightInput } from './entity-insights';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = new Date('2026-08-01T09:00:00Z');

function identity(
  over: Partial<IdentityInsightInput> = {},
): IdentityInsightInput {
  return {
    identityId: 'id-1',
    homeCountry: 'US',
    mfaStatus: 'enforced',
    isPrivileged: false,
    signIns: [],
    auditEvents: [],
    cloudEventCount: 0,
    ...over,
  };
}

const signIn = (
  daysIn: number,
  country: string,
  city = 'Chicago',
  over: Partial<IdentityInsightInput['signIns'][number]> = {},
) => ({
  occurredAt: new Date(T0.getTime() + daysIn * DAY),
  sourceCountry: country,
  sourceCity: city,
  result: 'success',
  isLegacyAuth: false,
  ...over,
});

const byId = (list: EntityInsight[], id: string) =>
  list.find((i) => i.id === id);

describe('computeIdentityInsights', () => {
  it('reports a single-country account as unremarkable', () => {
    const out = computeIdentityInsights(
      identity({
        signIns: [signIn(0, 'US'), signIn(5, 'US'), signIn(20, 'US')],
      }),
    );
    const countries = byId(out, 'identity.countries')!;
    expect(countries.tone).toBe('neutral');
    expect(countries.answer).toContain('Only US');
  });

  it('flags a first-ever sign-in location, which is what the baseline exists to expose', () => {
    const out = computeIdentityInsights(
      identity({
        signIns: [
          signIn(0, 'US'),
          signIn(10, 'US'),
          signIn(29, 'SG', 'Singapore'),
        ],
      }),
    );
    const newest = byId(out, 'identity.newest-location')!;
    expect(newest.tone).toBe('notable');
    expect(newest.answer).toContain('first on record');
    expect(newest.detail).toContain('29 days');
  });

  it('does not flag a return to a country already in the history', () => {
    const out = computeIdentityInsights(
      identity({
        signIns: [
          signIn(0, 'GB', 'London'),
          signIn(9, 'US'),
          signIn(25, 'GB', 'London'),
        ],
      }),
    );
    expect(byId(out, 'identity.newest-location')!.tone).toBe('neutral');
  });

  // The whole design rests on this: notable describes the data, never the verdict. A business
  // trip and a stolen credential are indistinguishable here on purpose — deciding between them
  // is the exercise, so the insight must not pre-empt it.
  it('says nothing about maliciousness — only that the observation is unusual', () => {
    const out = computeIdentityInsights(
      identity({ signIns: [signIn(0, 'US'), signIn(20, 'DE', 'Berlin')] }),
    );
    const text = JSON.stringify(out).toLowerCase();
    for (const word of [
      'malicious',
      'attack',
      'compromis',
      'threat',
      'suspicious',
    ]) {
      expect(text).not.toContain(word);
    }
  });

  it('surfaces legacy auth as a route around an enforced MFA policy', () => {
    const out = computeIdentityInsights(
      identity({
        signIns: [signIn(0, 'US', 'Chicago', { isLegacyAuth: true })],
      }),
    );
    const posture = byId(out, 'identity.auth-posture')!;
    expect(posture.tone).toBe('notable');
    expect(posture.answer).toContain('legacy protocol');
  });

  it('counts security-relevant directory changes separately from routine churn', () => {
    const out = computeIdentityInsights(
      identity({
        auditEvents: [
          {
            occurredAt: T0,
            category: 'group_membership',
            action: 'Add member to group',
            actorIdentityId: null,
          },
          {
            occurredAt: T0,
            category: 'mfa',
            action: 'User registered security info',
            actorIdentityId: 'id-1',
          },
          {
            occurredAt: T0,
            category: 'mailbox_rule',
            action: 'Create inbox rule',
            actorIdentityId: 'id-1',
          },
        ],
      }),
    );
    const changes = byId(out, 'identity.directory-changes')!;
    expect(changes.answer).toContain('3 directory changes');
    expect(changes.answer).toContain('2 touch credentials');
    expect(changes.tone).toBe('notable');
  });

  it('handles an account with no telemetry at all without inventing findings', () => {
    const out = computeIdentityInsights(identity());
    expect(byId(out, 'identity.countries')).toBeUndefined();
    expect(byId(out, 'identity.failures')!.tone).toBe('neutral');
  });
});

describe('computeDeviceInsights', () => {
  it('names the parent-child chain rather than just counting processes', () => {
    const out = computeDeviceInsights({
      isolationStatus: 'not_isolated',
      processes: [
        {
          imagePath: 'C:\\Windows\\System32\\rundll32.exe',
          parentImagePath: 'C:\\Windows\\System32\\cmd.exe',
          commandLine: 'rundll32 comsvcs.dll, MiniDump',
          integrityLevel: 'High',
        },
      ],
      files: [],
      network: [],
      httpRequests: [],
    });
    const procs = byId(out, 'device.processes')!;
    expect(procs.detail).toContain('cmd.exe → rundll32.exe');
    expect(procs.tone).toBe('notable');
  });

  it('points at a non-system volume without calling it exfiltration', () => {
    const out = computeDeviceInsights({
      isolationStatus: 'not_isolated',
      processes: [],
      files: [
        { action: 'created', filePath: 'E:\\Backup\\Source.zip' },
        { action: 'deleted', filePath: 'C:\\Shares\\Source.zip' },
      ],
      network: [],
      httpRequests: [],
    });
    const files = byId(out, 'device.files')!;
    expect(files.detail).toContain('removable media');
    expect(files.answer).toContain('1 created');
  });

  it('treats repeated contact with one address as worth explaining, not as a verdict', () => {
    const out = computeDeviceInsights({
      isolationStatus: 'not_isolated',
      processes: [],
      files: [],
      network: Array.from({ length: 6 }, () => ({
        remoteIp: '185.220.101.47',
        bytesSent: 300,
      })),
      httpRequests: [],
    });
    const net = byId(out, 'device.network')!;
    expect(net.tone).toBe('notable');
    expect(net.detail).toContain('worth explaining');
  });

  it('frames a scripted HTTP client as ambiguous, since monitoring looks the same', () => {
    const out = computeDeviceInsights({
      isolationStatus: 'not_isolated',
      processes: [],
      files: [],
      network: [],
      httpRequests: [
        { url: '/api/health-check.php', userAgent: 'curl/7.88.1' },
      ],
    });
    const http = byId(out, 'device.http')!;
    expect(http.detail).toContain('normal for monitoring');
    expect(http.detail).toContain('web shell');
  });
});

describe('computeEmailInsights', () => {
  const base = {
    senderAddress: 'billing@contoso-finance-exec.example.net',
    recipientAddresses: ['priya.kim@contoso-finance.example.com'],
    spfResult: 'fail',
    dkimResult: 'none',
    dmarcResult: 'fail',
    headers: {} as Record<string, unknown>,
    urlCount: 0,
    attachmentCount: 0,
    sameDomainCount: 1,
    linkClickCount: 0,
  };

  it('separates authentication failure from hostility', () => {
    const auth = byId(computeEmailInsights(base), 'email.authentication')!;
    expect(auth.answer).toContain('SPF, DKIM, DMARC did not pass');
    expect(auth.detail).toContain('not that the content is hostile');
  });

  it('spots a lookalike domain sharing a word with the recipient domain', () => {
    const dom = byId(computeEmailInsights(base), 'email.sender-domain')!;
    expect(dom.tone).toBe('notable');
    expect(dom.detail).toContain('survive a glance');
  });

  it('does not cry lookalike for an unrelated sending domain', () => {
    const dom = byId(
      computeEmailInsights({
        ...base,
        senderAddress: 'noreply@totally-different.example.org',
      }),
      'email.sender-domain',
    )!;
    expect(dom.tone).toBe('neutral');
  });

  it('surfaces a Reply-To that diverges from the visible sender', () => {
    const out = computeEmailInsights({
      ...base,
      headers: { 'Reply-To': '<attacker@elsewhere.example.net>' },
    });
    const reply = byId(out, 'email.reply-path')!;
    expect(reply.tone).toBe('notable');
    expect(reply.answer).toContain('Not to the visible sender');
  });

  it('reports no recorded click distinctly from having no links at all', () => {
    const withLinks = computeEmailInsights({ ...base, urlCount: 1 });
    expect(byId(withLinks, 'email.clicks')!.tone).toBe('neutral');
    expect(byId(withLinks, 'email.payload')).toBeUndefined();

    const clicked = computeEmailInsights({
      ...base,
      urlCount: 1,
      linkClickCount: 2,
    });
    expect(byId(clicked, 'email.clicks')!.tone).toBe('notable');
  });

  it('treats a message with no payload as a live question, not a dismissal', () => {
    const payload = byId(computeEmailInsights(base), 'email.payload')!;
    expect(payload.detail).toContain('Both are live possibilities');
  });
});
