import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { investigationsService } from "@/services/investigations";
import type { IncidentVerdict, ResponseActionType } from "@/types/socverse-investigation";

const keys = {
  session: (sessionId: string) => ["session", sessionId] as const,
  incidents: (sessionId: string) => ["session", sessionId, "incidents"] as const,
  incident: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId] as const,
  evidence: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId, "evidence"] as const,
  timeline: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId, "timeline"] as const,
  notes: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId, "notes"] as const,
  hints: (sessionId: string) => ["session", sessionId, "hints"] as const,
  score: (sessionId: string) => ["session", sessionId, "score"] as const,
  tasks: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId, "tasks"] as const,
  feedback: (sessionId: string, incidentId: string) =>
    ["session", sessionId, "incident", incidentId, "feedback"] as const,
  mitreTechniques: ["mitre-techniques"] as const,
};

/**
 * Polls a session until telemetry generation finishes (session.ready) — the real equivalent
 * of what was previously an instant, synchronous mock scenario launch. Session creation is
 * fast; the BullMQ job behind it isn't guaranteed to be.
 */
export function useSessionReadiness(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.session(sessionId) : ["session", "none"],
    queryFn: () => investigationsService.getSession(sessionId!),
    enabled: Boolean(sessionId),
    // A session that doesn't exist (deleted, expired, or a mistyped/stale URL) 404s every
    // time — without the error check here, this would poll a 404 forever instead of settling
    // on CaseWorkspace's own "Could not load this session" branch.
    refetchInterval: (query) =>
      query.state.status === "error" || query.state.data?.ready ? false : 1500,
  });
}

/** Resolves the one incident a session's case workspace should open — see the merge plan on
 * why launching a scenario creates exactly one incident together with its session, rather
 * than a variable number the UI would need to pick between. */
export function useSessionIncident(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.incidents(sessionId) : ["incidents", "none"],
    queryFn: () => investigationsService.listIncidents(sessionId!),
    enabled: Boolean(sessionId),
    select: (incidents) => incidents[0] as (typeof incidents)[number] | undefined,
  });
}

/** Scenario launch: create the session, then the one incident it'll be investigated through.
 * Telemetry generation (session.ready) runs async — the caller should route to the case
 * workspace immediately and let useSessionReadiness there show the "generating" state, rather
 * than block navigation on it here. */
export function useLaunchScenario() {
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const session = await investigationsService.createSession(scenarioId);
      const incident = await investigationsService.createIncident(
        session.id,
        "Primary investigation",
      );
      return { sessionId: session.id, incidentId: incident.id };
    },
  });
}

/** Standalone score poll, for anywhere that needs just the score without paying for the rest
 * of useInvestigation's incident/evidence/timeline/notes/hints queries (e.g. the closed-case
 * results panel, which has no real incidentId reason to be in scope). */
export function useSessionScore(sessionId: string) {
  return useQuery({
    queryKey: keys.score(sessionId),
    queryFn: () => investigationsService.getScore(sessionId),
    refetchInterval: (query) => (query.state.data ? false : 2000),
  });
}

/** Everything the one-incident-per-session case workspace needs (see the merge plan on why
 * launching a scenario creates exactly one incident, not a variable number). */
export function useInvestigation(sessionId: string, incidentId: string) {
  const queryClient = useQueryClient();

  const incidentQuery = useQuery({
    queryKey: keys.incident(sessionId, incidentId),
    queryFn: () => investigationsService.getIncident(sessionId, incidentId),
  });
  const evidenceQuery = useQuery({
    queryKey: keys.evidence(sessionId, incidentId),
    queryFn: () => investigationsService.listEvidence(sessionId, incidentId),
  });
  const timelineQuery = useQuery({
    queryKey: keys.timeline(sessionId, incidentId),
    queryFn: () => investigationsService.getTimeline(sessionId, incidentId),
  });
  const notesQuery = useQuery({
    queryKey: keys.notes(sessionId, incidentId),
    queryFn: () => investigationsService.listNotes(sessionId, incidentId),
  });
  const hintsQuery = useQuery({
    queryKey: keys.hints(sessionId),
    queryFn: () => investigationsService.listHints(sessionId),
  });
  const mitreQuery = useQuery({
    queryKey: keys.mitreTechniques,
    queryFn: () => investigationsService.listMitreTechniques(),
    staleTime: Infinity, // a global reference list, not session-scoped
  });

  const invalidateIncident = () => {
    queryClient.invalidateQueries({ queryKey: keys.incident(sessionId, incidentId) });
  };
  const invalidateEvidence = () => {
    queryClient.invalidateQueries({ queryKey: keys.evidence(sessionId, incidentId) });
  };
  const invalidateTimeline = () => {
    queryClient.invalidateQueries({ queryKey: keys.timeline(sessionId, incidentId) });
  };

  const pinEvidence = useMutation({
    mutationFn: (input: { eventTable: string; eventId: string; justification: string }) =>
      investigationsService.pinEvidence(sessionId, incidentId, input),
    onSuccess: invalidateEvidence,
  });
  const removeEvidence = useMutation({
    mutationFn: (evidenceId: string) =>
      investigationsService.removeEvidence(sessionId, incidentId, evidenceId),
    onSuccess: invalidateEvidence,
  });
  const addToTimeline = useMutation({
    mutationFn: (input: { eventTable: string; eventId: string }) =>
      investigationsService.addToTimeline(sessionId, incidentId, input),
    onSuccess: invalidateTimeline,
  });
  const removeFromTimeline = useMutation({
    mutationFn: ({ eventTable, eventId }: { eventTable: string; eventId: string }) =>
      investigationsService.removeFromTimeline(sessionId, incidentId, eventTable, eventId),
    onSuccess: invalidateTimeline,
  });
  const addNote = useMutation({
    mutationFn: (body: string) => investigationsService.addNote(sessionId, incidentId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.notes(sessionId, incidentId) }),
  });
  const unlockHint = useMutation({
    mutationFn: (index: number) => investigationsService.unlockHint(sessionId, index),
    onSuccess: (hints) => queryClient.setQueryData(keys.hints(sessionId), hints),
  });
  const logResponseAction = useMutation({
    mutationFn: ({
      actionType,
      targetType,
    }: {
      actionType: ResponseActionType;
      targetType: string;
    }) => investigationsService.logResponseAction(sessionId, incidentId, actionType, targetType),
  });
  const closeIncident = useMutation({
    mutationFn: (input: {
      verdict: IncidentVerdict;
      summary: string;
      mitreTechniqueIds: string[];
    }) => investigationsService.closeIncident(sessionId, incidentId, input),
    onSuccess: invalidateIncident,
  });
  const submitSession = useMutation({
    mutationFn: () => investigationsService.submitSession(sessionId, [incidentId]),
  });
  const search = useMutation({
    mutationFn: (input: { filters?: { field: string; value: string }[]; freetext?: string }) =>
      investigationsService.search(sessionId, input),
  });
  const lookupThreatIntel = useMutation({
    mutationFn: ({ type, value }: { type: "hash" | "ip" | "domain" | "url"; value: string }) =>
      investigationsService.lookupThreatIntel(sessionId, type, value),
  });

  return {
    incident: incidentQuery.data,
    incidentLoading: incidentQuery.isPending,
    evidence: evidenceQuery.data ?? [],
    timeline: timelineQuery.data ?? [],
    notes: notesQuery.data ?? [],
    hints: hintsQuery.data ?? [],
    mitreTechniques: mitreQuery.data ?? [],

    pinEvidence: pinEvidence.mutateAsync,
    removeEvidence: removeEvidence.mutateAsync,
    addToTimeline: addToTimeline.mutateAsync,
    removeFromTimeline: removeFromTimeline.mutateAsync,
    addNote: addNote.mutateAsync,
    unlockHint: unlockHint.mutateAsync,
    logResponseAction: logResponseAction.mutateAsync,
    closeIncident: closeIncident.mutateAsync,
    closingIncident: closeIncident.isPending,
    closeIncidentError: closeIncident.error,
    submitSession: submitSession.mutateAsync,
    submittingSession: submitSession.isPending,
    search: search.mutateAsync,
    searching: search.isPending,
    lookupThreatIntel: lookupThreatIntel.mutateAsync,
    lookingUpThreatIntel: lookupThreatIntel.isPending,
  };
}

/**
 * Instructor feedback on a closed incident. The endpoint has existed since Phase 4 and the
 * instructor's Feedback Center has been writing to it, but nothing ever read it back — so
 * review comments were written and stored where the student could never see them. Polls
 * while the case is closed, since feedback arrives whenever the instructor gets to it, not
 * at submit time.
 */
export function useIncidentFeedback(
  sessionId: string | undefined,
  incidentId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: sessionId && incidentId ? keys.feedback(sessionId, incidentId) : ["feedback", "none"],
    queryFn: () => investigationsService.listFeedback(sessionId!, incidentId!),
    enabled: Boolean(sessionId && incidentId && enabled),
    refetchInterval: 60_000,
  });
}

/** The investigation checklist for this incident — Sentinel-style task list. Definitions come
 * from the backend (category-derived), so rewording a step never needs a frontend release. */
export function useInvestigationTasks(
  sessionId: string | undefined,
  incidentId: string | undefined,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: sessionId && incidentId ? keys.tasks(sessionId, incidentId) : ["tasks", "none"],
    queryFn: () => investigationsService.listTasks(sessionId!, incidentId!),
    enabled: Boolean(sessionId && incidentId),
  });

  const toggle = useMutation({
    mutationFn: ({ taskKey, completed }: { taskKey: string; completed: boolean }) =>
      investigationsService.setTaskCompletion(sessionId!, incidentId!, taskKey, completed),
    // The server returns the whole recomputed list, so seed the cache with it rather than
    // refetching — ticking a box should feel instant.
    onSuccess: (data) => {
      if (sessionId && incidentId) {
        queryClient.setQueryData(keys.tasks(sessionId, incidentId), data);
      }
    },
  });

  return {
    tasks: query.data?.tasks ?? [],
    completedCount: query.data?.completedCount ?? 0,
    totalCount: query.data?.totalCount ?? 0,
    isPending: query.isPending,
    toggleTask: toggle.mutate,
    isToggling: toggle.isPending,
  };
}
