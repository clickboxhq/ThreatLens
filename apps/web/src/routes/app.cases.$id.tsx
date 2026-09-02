import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/soc/primitives";
import { HydrationBoundary } from "@/components/soc/ui/hydration-boundary";
import { EmailDetailDrawer } from "@/components/soc/email-detail-drawer";
import { IdentityDetailDrawer } from "@/components/soc/identity-detail-drawer";
import { DeviceDetailDrawer } from "@/components/soc/device-detail-drawer";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { ScenarioBriefing } from "@/components/soc/investigation/scenario-briefing";
import { InvestigationTransition } from "@/components/soc/investigation/investigation-transition";
import { InvestigationStepper, STAGES, type Stage } from "@/components/soc/investigation/investigation-stepper";
import { StageInvestigate } from "@/components/soc/investigation/stage-investigate";
import { StageEvidence } from "@/components/soc/investigation/stage-evidence";
import { StageResponse } from "@/components/soc/investigation/stage-response";
import { StageIntelligence } from "@/components/soc/investigation/stage-intelligence";
import { StageNotes } from "@/components/soc/investigation/stage-notes";
import { StageReview } from "@/components/soc/investigation/stage-review";
import { StageSubmit } from "@/components/soc/investigation/stage-submit";
import {
  useInvestigation,
  useSessionIncident,
  useSessionReadiness,
  useSessionScore,
  useIncidentFeedback,
} from "@/hooks/use-investigations";
import { ApiError } from "@/lib/api-client";
import { useIdentities } from "@/hooks/use-identities";
import { useEndpoints } from "@/hooks/use-endpoints";
import { toast } from "sonner";
import type { IncidentVerdict, ResponseActionType } from "@/types/socverse-investigation";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

const STAGE_IDS = new Set(STAGES.map((s) => s.id));

export const Route = createFileRoute("/app/cases/$id")({
  component: CaseWorkspace,
  validateSearch: (search: Record<string, unknown>): { stage?: Stage } => ({
    stage: STAGE_IDS.has(search.stage as Stage) ? (search.stage as Stage) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Case Management — ThreatLens" },
      {
        name: "description",
        content:
          "Work a single incident end to end: a staged investigation from briefing through evidence, response, intelligence, notes, and a scored verdict submission.",
      },
    ],
  }),
});

function CaseWorkspace() {
  const { id: sessionId } = Route.useParams();
  const readiness = useSessionReadiness(sessionId);

  if (readiness.isPending) {
    return <GeneratingScenario />;
  }
  if (readiness.isError) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-sm text-secondary">
          {readiness.error instanceof ApiError ? readiness.error.message : "Could not load this session."}
        </p>
        <Link to="/app/scenarios" className="mt-3 inline-block text-[13px] text-[color:var(--info)]">
          Back to Scenario Library
        </Link>
      </div>
    );
  }
  if (!readiness.data?.ready) {
    return <GeneratingScenario />;
  }

  return (
    <HydrationBoundary>
      <IncidentResolver sessionId={sessionId} />
    </HydrationBoundary>
  );
}

function GeneratingScenario() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <Loader2 className="size-6 animate-spin text-[color:var(--info)]" />
      <h2 className="text-[15px] font-semibold">Generating your scenario…</h2>
      <p className="max-w-sm text-[12.5px] text-secondary">
        Building out telemetry, alerts, and entities for this session. This usually takes a few
        seconds.
      </p>
    </div>
  );
}

function IncidentResolver({ sessionId }: { sessionId: string }) {
  const { data: incidentSummary, isPending } = useSessionIncident(sessionId);

  if (isPending) return <GeneratingScenario />;
  if (!incidentSummary) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-sm text-secondary">This session has no investigation open yet.</p>
        <Link to="/app/scenarios" className="mt-3 inline-block text-[13px] text-[color:var(--info)]">
          Back to Scenario Library
        </Link>
      </div>
    );
  }

  return <CaseWorkspaceInner sessionId={sessionId} incidentId={incidentSummary.id} />;
}

const BEGUN_KEY = (incidentId: string) => `threatlens:case:${incidentId}:begun`;

function CaseWorkspaceInner({ sessionId, incidentId }: { sessionId: string; incidentId: string }) {
  const { data: sessionIdentities } = useIdentities(sessionId);
  const { data: sessionDevices } = useEndpoints(sessionId);
  const nameFor = useMemo(() => {
    const byId = new Map<string, string>();
    for (const i of sessionIdentities ?? []) byId.set(i.id, i.displayName);
    for (const d of sessionDevices ?? []) byId.set(d.id, d.hostname);
    return (id: string) => byId.get(id);
  }, [sessionIdentities, sessionDevices]);

  // useInvestigation's queries all fire unconditionally from here, regardless of whether the
  // briefing or the workspace is on screen — so by the time an analyst has read the briefing
  // and clicked Begin Investigation, evidence/timeline/notes/hints are already warm in the
  // React Query cache. The transition screen isn't a fake delay hiding a fetch; the fetch
  // already started on mount.
  const {
    incident,
    incidentLoading,
    evidence,
    timeline,
    notes,
    hints,
    mitreTechniques,
    pinEvidence,
    removeEvidence,
    addToTimeline,
    removeFromTimeline,
    addNote,
    unlockHint,
    logResponseAction,
    closeIncident,
    closingIncident,
    submitSession,
    submittingSession,
    search,
    searching,
    lookupThreatIntel,
    lookingUpThreatIntel,
  } = useInvestigation(sessionId, incidentId);
  const { data: session } = useSessionReadiness(sessionId);

  const { stage } = Route.useSearch();
  const navigate = useNavigate();
  const setStage = (next: Stage) => navigate({ to: ".", search: { stage: next } });

  const [begun, setBegun] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BEGUN_KEY(incidentId)) === "1";
    } catch {
      return false;
    }
  });
  const [transitioning, setTransitioning] = useState(false);

  const [pendingRemoveEvidenceId, setPendingRemoveEvidenceId] = useState<string | null>(null);
  const [takenActions, setTakenActions] = useState<ResponseActionType[]>([]);
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [openIdentityId, setOpenIdentityId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);

  // Submit-stage draft, owned here rather than inside StageSubmit — that stage unmounts every
  // time the analyst navigates elsewhere in the stepper, and a draft the brief promises
  // survives free back-and-forth navigation can't live in state that disappears with it.
  const [verdict, setVerdict] = useState<IncidentVerdict | undefined>(undefined);
  const [summary, setSummary] = useState("");
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<string[]>([]);

  if (incidentLoading || !incident || !session) {
    return <GeneratingScenario />;
  }

  const locked = incident.status === "closed";
  const pinnedIds = new Set(evidence.map((e) => `${e.eventTable}:${e.eventId}`));
  const timelineIds = new Set(timeline.map((t) => `${t.eventTable}:${t.id}`));
  const nextHint = hints.find((h) => !h.unlocked);
  const pendingRemoveEvidenceItem = evidence.find((e) => e.id === pendingRemoveEvidenceId) ?? null;
  const activeStage: Stage = stage ?? (locked ? "submit" : "investigate");

  function handleBegin() {
    setTransitioning(true);
    window.setTimeout(() => {
      try {
        localStorage.setItem(BEGUN_KEY(incidentId), "1");
      } catch {
        // localStorage unavailable — this is a convenience flag only, not a security boundary,
        // so worst case the briefing shows again next visit.
      }
      setBegun(true);
      setTransitioning(false);
    }, 1200);
  }

  async function handleSubmit(input: {
    verdict: IncidentVerdict;
    summary: string;
    mitreTechniqueIds: string[];
  }) {
    await closeIncident(input);
    await submitSession();
  }

  // Closed incidents skip straight to the (read-only) workspace — never the briefing or
  // transition, matching the brief's own "the user can review, not modify" rule.
  if (!locked && !begun) {
    return <ScenarioBriefing session={session} onBegin={handleBegin} />;
  }
  if (transitioning) {
    return <InvestigationTransition />;
  }

  return (
    <div className="px-4 py-4 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/app/scenarios"
          className="inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Scenario Library
        </Link>
        {locked && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-secondary">
            <Lock className="size-3" /> Submitted — read only
          </span>
        )}
      </div>

      <SectionHeader
        title={session.scenarioTitle}
        description={`${incident.linkedAlertIds.length} linked alerts`}
      />

      <InvestigationStepper
        active={activeStage}
        done={{
          evidence: evidence.length > 0,
          notes: notes.length > 0,
          response: takenActions.length > 0,
        }}
        onNavigate={setStage}
        locked={locked}
        hints={hints}
        nextHintCost={nextHint?.unlockCostPercent ?? null}
        onUnlockHint={() => nextHint && unlockHint(nextHint.index)}
      />

      {activeStage === "investigate" && (
        <StageInvestigate
          search={search}
          searching={searching}
          nameFor={nameFor}
          pinnedIds={pinnedIds}
          timelineIds={timelineIds}
          locked={locked}
          onPin={(eventTable, eventId) => pinEvidence({ eventTable, eventId, justification: "Pinned during triage" })}
          onUnpin={(eventTable, eventId) => {
            const existing = evidence.find((e) => e.eventTable === eventTable && e.eventId === eventId);
            if (existing) removeEvidence(existing.id);
          }}
          onAddToTimeline={(eventTable, eventId) => addToTimeline({ eventTable, eventId })}
          onRemoveFromTimeline={(eventTable, eventId) => removeFromTimeline({ eventTable, eventId })}
          onOpenEmail={setOpenEmailId}
          onOpenIdentity={setOpenIdentityId}
          onOpenDevice={setOpenDeviceId}
        />
      )}

      {activeStage === "evidence" && (
        <StageEvidence
          evidence={evidence}
          timeline={timeline}
          locked={locked}
          onRemove={setPendingRemoveEvidenceId}
        />
      )}

      {activeStage === "response" && (
        <StageResponse
          takenActions={takenActions}
          locked={locked}
          onLogAction={async (actionType, targetType) => {
            await logResponseAction({ actionType, targetType });
            setTakenActions((prev) => [...prev, actionType]);
          }}
        />
      )}

      {activeStage === "intelligence" && (
        <StageIntelligence
          lookupThreatIntel={lookupThreatIntel}
          lookingUp={lookingUpThreatIntel}
          locked={locked}
          onAddFindingNote={(body) => addNote(body)}
        />
      )}

      {activeStage === "notes" && (
        <StageNotes notes={notes} locked={locked} onAddNote={(body) => addNote(body)} />
      )}

      {activeStage === "review" && (
        <StageReview
          sessionId={sessionId}
          incidentId={incident.id}
          locked={locked}
          evidenceCount={evidence.length}
          timelineCount={timeline.length}
          actionsCount={takenActions.length}
          notesCount={notes.length}
          hintsUsed={hints.filter((h) => h.unlocked).length}
          onNavigate={setStage}
        />
      )}

      {activeStage === "submit" &&
        (locked ? (
          <div className="mx-auto max-w-2xl">
            <ScoreResult sessionId={sessionId} incidentId={incident.id} />
          </div>
        ) : (
          <StageSubmit
            mitreTechniques={mitreTechniques}
            submitting={closingIncident || submittingSession}
            verdict={verdict}
            setVerdict={setVerdict}
            summary={summary}
            setSummary={setSummary}
            selectedTechniqueIds={selectedTechniqueIds}
            setSelectedTechniqueIds={setSelectedTechniqueIds}
            onSubmit={async (input) => {
              try {
                await handleSubmit(input);
                toast.success("Investigation submitted and scored.");
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Could not submit this incident.");
                throw err;
              }
            }}
          />
        ))}

      {openEmailId && (
        <EmailDetailDrawer
          sessionId={sessionId}
          emailId={openEmailId}
          onClose={() => setOpenEmailId(null)}
          onPin={(input) => pinEvidence(input)}
          isPinned={pinnedIds.has(`email_messages:${openEmailId}`)}
          onUnpin={() => {
            const pinned = evidence.find((e) => e.eventTable === "email_messages" && e.eventId === openEmailId);
            if (pinned) removeEvidence(pinned.id);
          }}
          locked={locked}
        />
      )}
      {openIdentityId && (
        <IdentityDetailDrawer
          sessionId={sessionId}
          identityId={openIdentityId}
          onClose={() => setOpenIdentityId(null)}
          quickPreviewLinkTo={`/app/identity/${sessionId}/${openIdentityId}`}
        />
      )}
      {openDeviceId && (
        <DeviceDetailDrawer
          sessionId={sessionId}
          deviceId={openDeviceId}
          onClose={() => setOpenDeviceId(null)}
          locked={locked}
          quickPreviewLinkTo={`/app/endpoints/${sessionId}/${openDeviceId}`}
        />
      )}

      <ConfirmDialog
        open={pendingRemoveEvidenceId !== null}
        onOpenChange={(open) => !open && setPendingRemoveEvidenceId(null)}
        title="Remove pinned evidence?"
        description="You are about to unpin this item from your evidence collection:"
        target={pendingRemoveEvidenceItem?.display?.title ?? "This item"}
        note="Your justification for pinning it will be lost. This doesn't affect the underlying event — you can pin it again later."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemoveEvidenceId) removeEvidence(pendingRemoveEvidenceId);
        }}
      />
    </div>
  );
}

function ScoreResult({ sessionId, incidentId }: { sessionId: string; incidentId: string | undefined }) {
  const { data: score } = useSessionScore(sessionId);
  const { data: feedback } = useIncidentFeedback(sessionId, incidentId, true);

  if (!score) {
    return (
      <div className="flex items-center gap-2 py-4 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Scoring your submission…
      </div>
    );
  }

  const rubric = [
    { label: "Technique accuracy", value: score.techniqueAccuracyPercent, weight: "30%" },
    { label: "Evidence recall", value: score.evidenceRecallPercent, weight: "15%" },
    { label: "Evidence precision", value: score.evidencePrecisionPercent, weight: "15%" },
    { label: "Verdict", value: score.verdictCorrect ? 100 : 0, weight: "10%" },
  ];

  return (
    <div className="glass-card p-5">
      <div className="flex items-end gap-3">
        <div className="t-metric">{Math.round(score.overallPercent)}</div>
        <div className="pb-1 text-[11.5px] text-muted-foreground">
          / 100
          {score.hintPenaltyPercent > 0 && <> · −{score.hintPenaltyPercent} hints</>}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {rubric.map((r) => (
          <li key={r.label}>
            <div className="flex items-center justify-between text-[11.5px]">
              <span>
                {r.label} <span className="text-muted-foreground">({r.weight})</span>
              </span>
              <span className="tabular-nums">{Math.round(r.value)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-[color:var(--info)]"
                style={{ width: `${r.value}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {feedback && feedback.length > 0 && (
        <div className="mt-4 rounded-md border border-[color:var(--info)]/40 bg-[color:var(--info)]/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--info)]">
            Instructor review
          </div>
          {feedback.map((f) => (
            <div key={f.id} className="mt-2">
              <p className="text-[12px] leading-[1.6] text-secondary">{f.comment}</p>
              <div className="mt-1.5 text-[10.5px] text-muted-foreground">
                {f.instructorDisplayName} · {new Date(f.createdAt).toLocaleDateString()}
                {f.reopenedSession && (
                  <span className="text-[color:var(--warning)]"> · reopened this case</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-[11.5px]">
        {score.rubricBreakdown.missedEvidence.length > 0 && (
          <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-2">
            <div className="font-medium">Missed evidence</div>
            <ul className="mt-1 text-[10.5px]">
              {score.rubricBreakdown.missedEvidence.map((e, i) => (
                <li key={i}>{e.summary}</li>
              ))}
            </ul>
          </div>
        )}
        {score.rubricBreakdown.missedTechniques.length > 0 && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="font-medium">Techniques you did not tag</div>
            <div className="mt-1 font-mono text-[10.5px]">
              {score.rubricBreakdown.missedTechniques.map((t) => t.techniqueId).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
