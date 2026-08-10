import { dedupeByEvent } from './scoring.service';

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
