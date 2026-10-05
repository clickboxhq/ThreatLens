// The "Active"/green-dot presence window. Deliberately short — matches "recent, real activity",
// not "logged in at some point today". Write points are discrete human-paced actions (pinning
// evidence, submitting a session, ...), not a continuous heartbeat, so this has to be generous
// enough to survive normal pauses between actions but short enough that someone who stopped
// working 30+ minutes ago reads as not-currently-active, per the presence design.
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export type PresenceStatus = 'active' | 'inactive' | 'never';

export function presenceStatus(
  lastMeaningfulActivityAt: Date | null,
): PresenceStatus {
  if (!lastMeaningfulActivityAt) return 'never';
  const elapsed = Date.now() - lastMeaningfulActivityAt.getTime();
  return elapsed <= PRESENCE_WINDOW_MS ? 'active' : 'inactive';
}
