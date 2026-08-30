// The questions a competent analyst asks of an entity, with the answers computed from the same
// telemetry the Student can already reach.
//
// This is deliberately an inversion of how production consoles use the idea. Sentinel's "Top
// insights" pre-answers expert questions so an analyst under time pressure does not have to know
// what to ask. Our constraint is the opposite: the learner has all the time they need and does
// *not* yet know which questions matter, so handing over pre-answered questions would remove the
// exact skill the product exists to build. The API returns question and answer together; the UI
// keeps the answer folded away until the learner asks for it.
//
// Two rules hold everything here honest:
//
//   1. Never compute from ground truth. Every answer below is derived from data already returned
//      by the portals — sign-ins, audit events, process trees, headers. An insight must never be
//      a shortcut to the answer key; it is a prompt to look somewhere real.
//
//   2. `notable` means the data is unusual, never that it is malicious. A legitimate business
//      trip and a stolen credential both produce "first sign-in from this country". Marking the
//      observation and leaving the judgement to the Student is the entire lesson — in a
//      false-positive scenario the notable insight is precisely the thing they must clear.

export type InsightTone = 'neutral' | 'notable';

export interface EntityInsight {
  /** Stable key, so the UI can remember which prompts a learner already opened. */
  id: string;
  question: string;
  answer: string;
  /** Supporting figures, shown alongside the answer rather than inside it. */
  detail?: string;
  tone: InsightTone;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function shortDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------------------

export interface IdentityInsightInput {
  homeCountry: string;
  mfaStatus: string;
  isPrivileged: boolean;
  signIns: {
    occurredAt: Date;
    sourceCountry: string;
    sourceCity: string;
    result: string;
    isLegacyAuth: boolean;
  }[];
  auditEvents: {
    occurredAt: Date;
    category: string;
    action: string;
    actorIdentityId: string | null;
  }[];
  cloudEventCount: number;
  identityId: string;
}

/** Categories whose appearance around an incident is worth a second look either way. */
const SENSITIVE_AUDIT_CATEGORIES = new Set([
  'mfa',
  'role_assignment',
  'mailbox_rule',
]);

export function computeIdentityInsights(
  input: IdentityInsightInput,
): EntityInsight[] {
  const insights: EntityInsight[] = [];
  const signIns = [...input.signIns].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  // --- Where has this account signed in from? The baseline question. -------------------------
  const firstSeenByCountry = new Map<string, Date>();
  const countByCountry = new Map<string, number>();
  for (const s of signIns) {
    if (s.result !== 'success') continue;
    if (!firstSeenByCountry.has(s.sourceCountry)) {
      firstSeenByCountry.set(s.sourceCountry, s.occurredAt);
    }
    countByCountry.set(
      s.sourceCountry,
      (countByCountry.get(s.sourceCountry) ?? 0) + 1,
    );
  }

  const countries = [...countByCountry.entries()].sort((a, b) => b[1] - a[1]);
  if (countries.length > 0) {
    const spread = countries.map(([c, n]) => `${c} (${n})`).join(', ');
    insights.push({
      id: 'identity.countries',
      question: 'Where does this account normally sign in from?',
      answer:
        countries.length === 1
          ? `Only ${countries[0][0]}, across every successful sign-in on record.`
          : `${plural(countries.length, 'country', 'countries')}, against a home country of ${input.homeCountry}.`,
      detail: spread,
      tone: countries.length > 1 ? 'notable' : 'neutral',
    });

    // --- Is the most recent location a first? The tell the baseline exists to expose. --------
    const lastSuccess = [...signIns]
      .reverse()
      .find((s) => s.result === 'success');
    if (lastSuccess) {
      const firstSeen = firstSeenByCountry.get(lastSuccess.sourceCountry)!;
      const isFirstEver =
        firstSeen.getTime() === lastSuccess.occurredAt.getTime();
      const priorDays = Math.round(
        (lastSuccess.occurredAt.getTime() - signIns[0].occurredAt.getTime()) /
          DAY_MS,
      );
      insights.push({
        id: 'identity.newest-location',
        question: 'Has this account signed in from that location before?',
        answer: isFirstEver
          ? `No. The latest sign-in from ${lastSuccess.sourceCity}, ${lastSuccess.sourceCountry} is the first on record.`
          : `Yes — first seen from ${lastSuccess.sourceCountry} on ${shortDate(firstSeen)}.`,
        detail: `History spans roughly ${plural(priorDays, 'day')}.`,
        tone: isFirstEver ? 'notable' : 'neutral',
      });
    }
  }

  // --- Did authentication ever fail? --------------------------------------------------------
  const failures = signIns.filter((s) => s.result !== 'success');
  insights.push({
    id: 'identity.failures',
    question: 'Has authentication ever failed for this account?',
    answer:
      failures.length === 0
        ? 'No. Every recorded attempt succeeded.'
        : `Yes — ${plural(failures.length, 'failed attempt')} on record.`,
    detail:
      failures.length > 0
        ? [...new Set(failures.map((f) => f.result))].join(', ')
        : undefined,
    tone: failures.length > 0 ? 'notable' : 'neutral',
  });

  // --- Legacy auth: the control bypass that leaves MFA intact but unused. --------------------
  const legacy = signIns.filter((s) => s.isLegacyAuth);
  if (legacy.length > 0 || input.mfaStatus !== 'enforced') {
    insights.push({
      id: 'identity.auth-posture',
      question: 'Could multi-factor authentication have been bypassed here?',
      answer:
        legacy.length > 0
          ? `${plural(legacy.length, 'sign-in')} used a legacy protocol, which does not carry an MFA challenge.`
          : `MFA is ${input.mfaStatus.replace(/_/g, ' ')} for this account.`,
      detail:
        input.mfaStatus === 'registered_not_enforced'
          ? 'Registered but not enforced — the factor exists and is not required.'
          : undefined,
      tone:
        legacy.length > 0 || input.mfaStatus !== 'enforced'
          ? 'notable'
          : 'neutral',
    });
  }

  // --- What changed on the account itself? The audit-trail question. ------------------------
  const sensitive = input.auditEvents.filter((e) =>
    SENSITIVE_AUDIT_CATEGORIES.has(e.category),
  );
  insights.push({
    id: 'identity.directory-changes',
    question: 'Did anything change on the account itself?',
    answer:
      input.auditEvents.length === 0
        ? 'No directory changes are recorded for this account.'
        : `${plural(input.auditEvents.length, 'directory change')}, of which ${sensitive.length} touch credentials, MFA, roles or mailbox rules.`,
    detail:
      sensitive.length > 0
        ? [...new Set(sensitive.map((e) => e.action))].slice(0, 4).join(' · ')
        : undefined,
    tone: sensitive.length > 0 ? 'notable' : 'neutral',
  });

  // --- Blast radius, if this account is the one that moved. ---------------------------------
  if (input.isPrivileged || input.cloudEventCount > 0) {
    insights.push({
      id: 'identity.reach',
      question: 'How much could this account reach?',
      answer: input.isPrivileged
        ? 'This is a privileged account — elevated access to the environment.'
        : `Standard access, with ${plural(input.cloudEventCount, 'cloud-plane action')} recorded.`,
      detail:
        input.cloudEventCount > 0
          ? `${plural(input.cloudEventCount, 'cloud event')} on the Cloud activity tab.`
          : undefined,
      tone: input.isPrivileged ? 'notable' : 'neutral',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------------------------

export interface DeviceInsightInput {
  isolationStatus: string;
  processes: {
    imagePath: string;
    parentImagePath: string | null;
    commandLine: string;
    integrityLevel: string;
  }[];
  files: { action: string; filePath: string }[];
  network: { remoteIp: string; bytesSent: number }[];
  httpRequests: { url: string; userAgent: string }[];
}

function baseName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

export function computeDeviceInsights(
  input: DeviceInsightInput,
): EntityInsight[] {
  const insights: EntityInsight[] = [];

  if (input.processes.length > 0) {
    const elevated = input.processes.filter(
      (p) => p.integrityLevel === 'High' || p.integrityLevel === 'System',
    );
    insights.push({
      id: 'device.processes',
      question: 'What ran on this host, and what launched it?',
      answer: `${plural(input.processes.length, 'process')} recorded${
        elevated.length ? `, ${elevated.length} at elevated integrity` : ''
      }.`,
      detail: input.processes
        .slice(0, 3)
        .map((p) =>
          p.parentImagePath
            ? `${baseName(p.parentImagePath)} → ${baseName(p.imagePath)}`
            : baseName(p.imagePath),
        )
        .join(' · '),
      tone: elevated.length > 0 ? 'notable' : 'neutral',
    });
  }

  if (input.files.length > 0) {
    const actions = new Map<string, number>();
    for (const f of input.files)
      actions.set(f.action, (actions.get(f.action) ?? 0) + 1);
    const removable = input.files.filter((f) => /^[D-Z]:\\/i.test(f.filePath));
    insights.push({
      id: 'device.files',
      question: 'What did those processes read or write?',
      answer: [...actions.entries()].map(([a, n]) => `${n} ${a}`).join(', '),
      detail: removable.length
        ? `${plural(removable.length, 'file')} on a non-system volume — check whether that is removable media.`
        : input.files
            .slice(0, 2)
            .map((f) => f.filePath)
            .join(' · '),
      tone: removable.length > 0 ? 'notable' : 'neutral',
    });
  }

  if (input.network.length > 0) {
    const byIp = new Map<string, number>();
    for (const n of input.network)
      byIp.set(n.remoteIp, (byIp.get(n.remoteIp) ?? 0) + 1);
    const top = [...byIp.entries()].sort((a, b) => b[1] - a[1])[0];
    const repeated = top && top[1] >= 5;
    insights.push({
      id: 'device.network',
      question: 'Where did this host talk to, and how often?',
      answer: `${plural(input.network.length, 'connection')} across ${plural(byIp.size, 'destination')}.`,
      detail: top
        ? `Most frequent: ${top[0]} (${plural(top[1], 'connection')})${
            repeated
              ? ' — regular repetition to one address is worth explaining.'
              : ''
          }`
        : undefined,
      tone: repeated ? 'notable' : 'neutral',
    });
  }

  if (input.httpRequests.length > 0) {
    const nonBrowser = input.httpRequests.filter((r) =>
      /^(curl|python-requests|Wget|PowerShell)/i.test(r.userAgent),
    );
    const paths = new Set(input.httpRequests.map((r) => r.url.split('?')[0]));
    insights.push({
      id: 'device.http',
      question: 'What kind of client made the web requests?',
      answer:
        nonBrowser.length > 0
          ? `${plural(nonBrowser.length, 'request')} came from a scripted client rather than a browser.`
          : 'All requests came from browser-like clients.',
      detail: `${plural(paths.size, 'distinct path')} requested. A scripted client is normal for monitoring and normal for a web shell — the path it touches separates them.`,
      tone: nonBrowser.length > 0 ? 'notable' : 'neutral',
    });
  }

  insights.push({
    id: 'device.containment',
    question: 'Is this host currently contained?',
    answer:
      input.isolationStatus === 'isolated'
        ? 'Yes — the host is isolated from the network.'
        : 'No. The host is still on the network.',
    tone: 'neutral',
  });

  return insights;
}

// ---------------------------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------------------------

export interface EmailInsightInput {
  senderAddress: string;
  recipientAddresses: string[];
  spfResult: string;
  dkimResult: string;
  dmarcResult: string;
  headers: Record<string, unknown>;
  urlCount: number;
  attachmentCount: number;
  /** Other messages in the session from the same sending domain. */
  sameDomainCount: number;
  /** Recorded clicks on this message's links, from the session's own web telemetry. */
  linkClickCount: number;
}

function domainOf(address: string): string {
  return address.split('@').pop() ?? address;
}

export function computeEmailInsights(
  input: EmailInsightInput,
): EntityInsight[] {
  const insights: EntityInsight[] = [];
  const senderDomain = domainOf(input.senderAddress);
  const recipientDomains = [...new Set(input.recipientAddresses.map(domainOf))];

  const authFailures = [
    input.spfResult !== 'pass' ? 'SPF' : null,
    input.dkimResult !== 'pass' ? 'DKIM' : null,
    input.dmarcResult !== 'pass' ? 'DMARC' : null,
  ].filter(Boolean) as string[];

  insights.push({
    id: 'email.authentication',
    question: 'Did the message authenticate as its sending domain?',
    answer:
      authFailures.length === 0
        ? 'Yes — SPF, DKIM and DMARC all pass.'
        : `No. ${authFailures.join(', ')} did not pass.`,
    detail: `spf=${input.spfResult} · dkim=${input.dkimResult} · dmarc=${input.dmarcResult}. Failure proves the sending infrastructure is unauthorised, not that the content is hostile.`,
    tone: authFailures.length > 0 ? 'notable' : 'neutral',
  });

  const lookalike = recipientDomains.some(
    (rd) => rd !== senderDomain && sharesStem(rd, senderDomain),
  );
  insights.push({
    id: 'email.sender-domain',
    question: 'Does the sending domain resemble one the organisation uses?',
    answer: lookalike
      ? `${senderDomain} is not the recipient domain, but is built from the same words.`
      : `Sending domain is ${senderDomain}; recipients are on ${recipientDomains.join(', ') || 'an unknown domain'}.`,
    detail: lookalike
      ? 'Near-miss domains are registered specifically to survive a glance.'
      : undefined,
    tone: lookalike ? 'notable' : 'neutral',
  });

  // Reply-To divergence — the mechanism that makes a reply reach the attacker.
  const replyTo =
    typeof input.headers['Reply-To'] === 'string'
      ? (input.headers['Reply-To'] as string)
      : undefined;
  const returnPath =
    typeof input.headers['Return-Path'] === 'string'
      ? (input.headers['Return-Path'] as string)
      : undefined;
  if (replyTo || returnPath) {
    const replyDiverges = !!replyTo && !replyTo.includes(input.senderAddress);
    insights.push({
      id: 'email.reply-path',
      question: 'Where would a reply to this message actually go?',
      answer: replyDiverges
        ? `Not to the visible sender. Reply-To is ${replyTo}.`
        : 'Back to the address shown in the From header.',
      detail: returnPath ? `Return-Path: ${returnPath}` : undefined,
      tone: replyDiverges ? 'notable' : 'neutral',
    });
  }

  insights.push({
    id: 'email.spread',
    question: 'Did anyone else receive mail from this sender?',
    answer:
      input.sameDomainCount === 0
        ? 'No other message in this session comes from that sending domain.'
        : `${plural(input.sameDomainCount, 'other message')} in this session share the sending domain.`,
    tone: input.sameDomainCount > 0 ? 'notable' : 'neutral',
  });

  if (input.urlCount > 0) {
    insights.push({
      id: 'email.clicks',
      question: 'Did anyone act on the links in this message?',
      answer:
        input.linkClickCount === 0
          ? 'No requests to those links appear in this session’s web telemetry.'
          : `Yes — ${plural(input.linkClickCount, 'recorded click')}.`,
      detail: `${plural(input.urlCount, 'link')} in the message. A click turns a delivered phish into a live incident.`,
      tone: input.linkClickCount > 0 ? 'notable' : 'neutral',
    });
  }

  if (input.attachmentCount === 0 && input.urlCount === 0) {
    insights.push({
      id: 'email.payload',
      question: 'What is this message actually asking for?',
      answer: 'It carries no links and no attachments.',
      detail:
        'With no payload, the pretext is the payload — or there is no attack at all. Both are live possibilities.',
      tone: 'notable',
    });
  }

  return insights;
}

/** Crude but useful: do two domains share a meaningful word, e.g. contoso-finance vs contoso. */
function sharesStem(a: string, b: string): boolean {
  const words = (d: string) =>
    d
      .split('.')[0]
      .split(/[-_]/)
      .filter((w) => w.length >= 4);
  const wa = new Set(words(a));
  return words(b).some((w) => wa.has(w));
}
