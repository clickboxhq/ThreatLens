import { dedupeByEvent, ScoringService } from './scoring.service';
import type { PrismaService } from '../../prisma/prisma.service';

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
