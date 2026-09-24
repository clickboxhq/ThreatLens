import { presenceStatus, PRESENCE_WINDOW_MS } from './presence';

describe('presenceStatus', () => {
  it('returns "never" when there is no activity record at all', () => {
    expect(presenceStatus(null)).toBe('never');
  });

  it('returns "active" for activity well within the window', () => {
    expect(presenceStatus(new Date(Date.now() - 30_000))).toBe('active');
  });

  it('returns "active" exactly at the edge of the window', () => {
    expect(presenceStatus(new Date(Date.now() - PRESENCE_WINDOW_MS))).toBe(
      'active',
    );
  });

  it('returns "inactive" just past the window', () => {
    expect(
      presenceStatus(new Date(Date.now() - PRESENCE_WINDOW_MS - 1000)),
    ).toBe('inactive');
  });

  it('returns "inactive" for activity from days ago, not "never"', () => {
    expect(presenceStatus(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))).toBe(
      'inactive',
    );
  });

  it('never treats a stale session as current activity — only the stored timestamp matters', () => {
    // This is the whole point of the presence design: there is no "session is still valid so
    // count as active" branch anywhere in this function. A user with a perfectly live,
    // non-expired auth session but no recent lastMeaningfulActivityAt still reads as inactive.
    const staleActivity = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    expect(presenceStatus(staleActivity)).toBe('inactive');
  });
});
