import {
  classifyTriage,
  correlationGroups,
  dedupeByEvent,
  evaluateContainment,
  ScoringService,
  type TriageAlertFact,
} from './scoring.service';
import type { PrismaService } from '../../prisma/prisma.service';

function alert(
  id: string,
  overrides: Partial<TriageAlertFact> = {},
): TriageAlertFact {
  return {
    id,
    title: `Alert ${id}`,
    status: 'new',
    dismissalReason: null,
    isFalsePositiveByDesign: false,
    evidenceEventIds: [`${id}-ev`],
    ...overrides,
  };
}

// §8.6 / §12.4 component 3. Every alert ends up in exactly one bucket, and the bucket is what
// the debrief shows — so a misfiled alert is both a wrong score and a wrong explanation.
describe('classifyTriage', () => {
  it('files a real alert as escalated when it is linked to the incident', () => {
    const out = classifyTriage([alert('a')], new Set(['a']), new Set());
    expect(out.realAlertsEscalated).toBe(1);
    expect(out.escalatedCorrectly).toEqual(['Alert a']);
    expect(out.untouched).toEqual([]);
  });

  it('files a real alert as dismissed only when a reason was given', () => {
    const withReason = classifyTriage(
      [alert('a', { status: 'dismissed', dismissalReason: 'VPN, confirmed' })],
      new Set(),
      new Set(),
    );
    const withoutReason = classifyTriage(
      [alert('a', { status: 'dismissed', dismissalReason: null })],
      new Set(),
      new Set(),
    );
    expect(withReason.realAlertsDismissed).toBe(1);
    expect(withReason.dismissedReal).toEqual(['Alert a']);
    expect(withoutReason.realAlertsDismissed).toBe(0);
    expect(withoutReason.untouched).toEqual(['Alert a']);
  });

  it('treats a bait alert as swept in whether it was escalated or merely had evidence pinned', () => {
    const bait = { isFalsePositiveByDesign: true };
    const escalated = classifyTriage(
      [alert('b', bait)],
      new Set(['b']),
      new Set(),
    );
    const pinned = classifyTriage(
      [alert('b', bait)],
      new Set(),
      new Set(['b-ev']),
    );
    expect(escalated.baitAlertsMishandled).toBe(1);
    expect(pinned.baitAlertsMishandled).toBe(1);
    expect(pinned.escalatedBait).toEqual(['Alert b']);
  });

  it('credits a bait alert dismissed with a reason', () => {
    const out = classifyTriage(
      [
        alert('b', {
          isFalsePositiveByDesign: true,
          status: 'dismissed',
          dismissalReason: 'Scheduled job, see ticket',
        }),
      ],
      new Set(),
      new Set(),
    );
    expect(out.baitAlertsDismissed).toBe(1);
    expect(out.dismissedCorrectly).toEqual(['Alert b']);
  });

  it('counts "resolved" as untouched — it is not a triage decision', () => {
    const out = classifyTriage(
      [alert('a', { status: 'resolved' })],
      new Set(),
      new Set(),
    );
    expect(out.untouched).toEqual(['Alert a']);
    expect(out.alertCount).toBe(1);
  });

  it('leaves a real alert whose evidence was pinned but never escalated as untouched', () => {
    // The pin already earns evidence marks; triage is about the alert-level decision.
    const out = classifyTriage([alert('a')], new Set(), new Set(['a-ev']));
    expect(out.realAlertsEscalated).toBe(0);
    expect(out.untouched).toEqual(['Alert a']);
  });
});

// §12.4 component 4, now real. The two things that would silently move everyone's mark are
// matching on the wrong entity and counting one action against two expectations.
describe('evaluateContainment', () => {
  const targets = new Map([
    ['victim_identity_1', { id: 'id-1', label: 'Ada Obi' }],
    ['victim_device_1', { id: 'dev-1', label: 'FIN-WKS-07' }],
  ]);
  const labels = new Map([
    ['id-1', 'Ada Obi'],
    ['dev-1', 'FIN-WKS-07'],
    ['dev-2', 'ENG-WKS-12'],
  ]);

  it('meets an expectation only when the action hit the entity the ref resolves to', () => {
    const expectations = [
      { action: 'isolate_device' as const, target: 'victim_device_1' },
    ];
    const right = evaluateContainment(
      expectations,
      [{ actionType: 'isolate_device', targetId: 'dev-1' }],
      targets,
      labels,
    );
    const wrongDevice = evaluateContainment(
      expectations,
      [{ actionType: 'isolate_device', targetId: 'dev-2' }],
      targets,
      labels,
    );
    expect(right.metCount).toBe(1);
    expect(right.met).toEqual([
      { action: 'isolate_device', targetLabel: 'FIN-WKS-07' },
    ]);
    expect(wrongDevice.metCount).toBe(0);
    expect(wrongDevice.missed).toEqual([
      { action: 'isolate_device', targetLabel: 'FIN-WKS-07' },
    ]);
    expect(wrongDevice.unnecessary).toEqual([
      { action: 'isolate_device', targetLabel: 'ENG-WKS-12' },
    ]);
  });

  it('does not let one action satisfy two expectations', () => {
    const out = evaluateContainment(
      [
        { action: 'isolate_device' as const, target: 'victim_device_1' },
        { action: 'isolate_device' as const, target: 'victim_device_1' },
      ],
      [{ actionType: 'isolate_device', targetId: 'dev-1' }],
      targets,
      labels,
    );
    expect(out.metCount).toBe(1);
    expect(out.missed).toHaveLength(1);
  });

  it('lists every action taken against an unexpected target as unnecessary', () => {
    const out = evaluateContainment(
      [],
      [
        { actionType: 'disable_account', targetId: 'id-1' },
        { actionType: 'block_ip', targetId: 'incident-xyz' },
      ],
      targets,
      labels,
    );
    expect(out.unnecessaryCount).toBe(2);
    expect(out.unnecessary).toEqual([
      { action: 'disable_account', targetLabel: 'Ada Obi' },
      { action: 'block_ip', targetLabel: 'an unspecified target' },
    ]);
  });

  it('reports an expectation whose ref never resolved as missed, never as met', () => {
    // An authoring slip the validator should catch — but if it reaches scoring it must not
    // quietly hand out marks.
    const out = evaluateContainment(
      [{ action: 'revoke_tokens' as const, target: 'no_such_ref' }],
      [{ actionType: 'revoke_tokens', targetId: 'id-1' }],
      targets,
      labels,
    );
    expect(out.metCount).toBe(0);
    expect(out.missed).toEqual([
      { action: 'revoke_tokens', targetLabel: 'no_such_ref' },
    ]);
  });
});

// The debrief's reveal of the generator's grouping. relatedAlertId points each member at the
// group's first alert, which is enough to rebuild the sets without ever reading correlation_id.
describe('correlationGroups', () => {
  it('rebuilds a chain from relatedAlertId pointers and drops singletons', () => {
    const groups = correlationGroups([
      { id: 'a', title: 'Phish delivered', relatedAlertId: null },
      { id: 'b', title: 'Risky sign-in', relatedAlertId: 'a' },
      { id: 'c', title: 'Forwarding rule', relatedAlertId: 'a' },
      { id: 'd', title: 'Lone bait', relatedAlertId: null },
    ]);
    expect(groups).toEqual([
      { alertTitles: ['Phish delivered', 'Risky sign-in', 'Forwarding rule'] },
    ]);
  });

  it('ignores a pointer to an alert that is not in the session', () => {
    const groups = correlationGroups([
      { id: 'a', title: 'A', relatedAlertId: 'ghost' },
      { id: 'b', title: 'B', relatedAlertId: 'a' },
    ]);
    expect(groups).toEqual([{ alertTitles: ['A', 'B'] }]);
  });
});

describe('dedupeByEvent (§2.9, §12.4)', () => {
  it('keeps a single copy of an item pinned as both evidence and a timeline entry', () => {
    const evidence = {
      eventTable: 'process_events',
      eventId: 'e-1',
      justification: 'x',
    };
    const timeline = {
      eventTable: 'process_events',
      eventId: 'e-1',
      addedBy: 'u-1',
    };

    const result = dedupeByEvent([evidence, timeline]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(evidence); // first occurrence wins
  });

  it('keeps distinct events separate', () => {
    const a = { eventTable: 'process_events', eventId: 'e-1' };
    const b = { eventTable: 'process_events', eventId: 'e-2' };
    const c = { eventTable: 'file_events', eventId: 'e-1' }; // same eventId, different table

    expect(dedupeByEvent([a, b, c])).toHaveLength(3);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeByEvent([])).toEqual([]);
  });
});

/**
 * Evidence precision is the half of the score that says "and how much of what you collected
 * was actually relevant", and until now nothing exercised the query behind it — the spec here
 * covered a pure dedupe helper and stopped. The lookup it depends on spreads ids across seven
 * telemetry tables and reassembles them, which is precisely the kind of thing that breaks
 * quietly: a wrong result does not throw, it just moves everyone's mark.
 */
describe('ScoringService.findGroundTruthAmong', () => {
  function build(groundTruthIds: Record<string, string[]>) {
    const model = (table: string) => ({
      findMany: jest.fn(
        async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in
            .filter((id) => (groundTruthIds[table] ?? []).includes(id))
            .map((id) => ({ id })),
      ),
    });

    const prisma = {
      emailMessage: model('email_messages'),
      signInEvent: model('sign_in_events'),
      processEvent: model('process_events'),
      fileEvent: model('file_events'),
      networkEvent: model('network_events'),
      cloudEvent: model('cloud_events'),
      httpRequest: model('http_requests'),
    } as unknown as PrismaService;

    const service = new ScoringService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
    );
    // The method is private because nothing outside the scorer should be asking; the
    // behaviour it encodes is still the score itself, so it is worth pinning down directly.
    return (items: { eventTable: string; eventId: string }[]) =>
      (
        service as unknown as {
          findGroundTruthAmong: (
            i: { eventTable: string; eventId: string }[],
          ) => Promise<Set<string>>;
        }
      ).findGroundTruthAmong(items);
  }

  it('returns only the items that are real evidence', async () => {
    const find = build({ email_messages: ['e-1'], process_events: ['p-9'] });

    const found = await find([
      { eventTable: 'email_messages', eventId: 'e-1' },
      { eventTable: 'email_messages', eventId: 'e-2' },
      { eventTable: 'process_events', eventId: 'p-9' },
    ]);

    expect([...found].sort()).toEqual(['e-1', 'p-9']);
  });

  it('spans every telemetry table rather than whichever one came first', async () => {
    // Each surface is a separate table, and one left out of the lookup silently stops
    // counting — the same gap the Device Portal tables hit once already.
    const tables = [
      'email_messages',
      'sign_in_events',
      'process_events',
      'file_events',
      'network_events',
      'cloud_events',
      'http_requests',
    ];
    const find = build(Object.fromEntries(tables.map((t) => [t, [`${t}-gt`]])));

    const found = await find(
      tables.map((t) => ({ eventTable: t, eventId: `${t}-gt` })),
    );

    expect(found.size).toBe(tables.length);
  });

  it('ignores a table it does not know rather than throwing', async () => {
    // Scoring a submitted session must not fail outright because a surface was added
    // without being wired in here; it degrades to not counting, which is the old behaviour.
    const find = build({ email_messages: ['e-1'] });

    const found = await find([
      { eventTable: 'email_messages', eventId: 'e-1' },
      { eventTable: 'something_new', eventId: 'x-1' },
    ]);

    expect([...found]).toEqual(['e-1']);
  });

  it('counts nothing when none of the collected items are evidence', async () => {
    // The precision-zero case: everything pinned was noise.
    const find = build({ email_messages: [] });

    const found = await find([
      { eventTable: 'email_messages', eventId: 'e-1' },
      { eventTable: 'email_messages', eventId: 'e-2' },
    ]);

    expect(found.size).toBe(0);
  });
});
