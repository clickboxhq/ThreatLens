/**
 * Real-time presence indicator — distinct from account/membership status badges. Deliberately a
 * plain dot with no redundant "Active" text label: it always sits next to a relative-time value
 * under a "Last active" column, so the text already carries the detail and the dot only needs to
 * carry the at-a-glance color. Never conflate this with account status (enabled/suspended) —
 * a member can be Enabled + Inactive, and that's a completely valid, expected state.
 */
export function PresenceDot({ status }: { status: "active" | "inactive" | "never" }) {
  if (status === "active") {
    return (
      <span
        aria-label="Active now"
        title="Active now"
        className="inline-block size-1.5 shrink-0 rounded-full bg-[color:var(--success)]"
      />
    );
  }
  return (
    <span
      aria-label={status === "never" ? "No activity yet" : "Not currently active"}
      title={status === "never" ? "No activity yet" : "Not currently active"}
      className="inline-block size-1.5 shrink-0 rounded-full bg-muted-foreground/30"
    />
  );
}
