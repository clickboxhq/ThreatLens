import { useMemo, useState } from "react";
import { useMySessions } from "./use-sessions";
import type { SessionListItemDto } from "@/types/socverse-operations";

/**
 * The Alert Center and the identity/device/email portals are all scoped to one investigation
 * session at a time — SOCVerse generates each scenario's telemetry fresh per session, so there's
 * no cross-session "org" for a global alert/identity/device view to draw from (see
 * socverse-operations.ts). This resolves which session a page like that should show: the most
 * recently started still-active one by default, with an explicit override for students running
 * more than one investigation at once.
 */
export function useActiveSession() {
  const sessionsQuery = useMySessions();
  const [overrideId, setOverrideId] = useState<string | null>(null);

  const activeSessions = useMemo<SessionListItemDto[]>(
    () =>
      (sessionsQuery.data ?? [])
        .filter((s) => s.status === "active")
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [sessionsQuery.data],
  );

  const selected = activeSessions.find((s) => s.id === overrideId) ?? activeSessions[0] ?? null;

  return {
    isLoading: sessionsQuery.isLoading,
    activeSessions,
    selectedSession: selected,
    selectedSessionId: selected?.id,
    setSelectedSessionId: setOverrideId,
  };
}
