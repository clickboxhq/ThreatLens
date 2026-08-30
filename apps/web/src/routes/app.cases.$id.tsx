import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { HydrationBoundary } from "@/components/soc/ui/hydration-boundary";
import { EmailDetailDrawer } from "@/components/soc/email-detail-drawer";
import { IdentityDetailDrawer } from "@/components/soc/identity-detail-drawer";
import { DeviceDetailDrawer } from "@/components/soc/device-detail-drawer";
import {
  useInvestigation,
  useSessionIncident,
  useSessionReadiness,
  useSessionScore,
  useIncidentFeedback,
} from "@/hooks/use-investigations";
import { ApiError } from "@/lib/api-client";
import { labelForResult, detailForResult } from "@/lib/search-result-format";
import {
  RESPONSE_ACTION_TYPES,
  type IncidentVerdict,
  type ResponseActionType,
  type SearchEntityType,
} from "@/types/socverse-investigation";
import { REPUTATION_SEVERITY } from "@/types/threat-intel-page";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lightbulb,
  ListTree,
  Lock,
  Loader2,
  Mail,
  MonitorSmartphone,
  Paperclip,
  Pin,
  PinOff,
  Radar,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/app/cases/$id")({
  component: CaseWorkspace,
  head: () => ({
    meta: [
      { title: "Case Management — ThreatLens" },
      {
        name: "description",
        content:
          "Work a single incident end to end: evidence locker, timeline, analyst notes, response actions, and scored verdict submission.",
      },
    ],
  }),
});

const VERDICTS: { id: IncidentVerdict; label: string; hint: string }[] = [
  { id: "true_positive", label: "True positive", hint: "Malicious activity confirmed with impact" },
  {
    id: "false_positive",
    label: "False positive",
    hint: "Detection fired on non-malicious activity",
  },
  {
    id: "benign_positive",
    label: "Benign positive",
    hint: "Real malicious signal, no impact realised",
  },
];

// ThreatLens's response-actions panel has no entity picker — see
// apps/api/.../dto/incident.dto.ts's LogResponseActionDto for why these are generic,
// audit-only actions rather than per-device/identity/email mutations.
const RESPONSE_ACTIONS: { id: ResponseActionType; label: string; target: string }[] = [
  { id: "isolate_device", label: "Isolate device", target: "device" },
  { id: "disable_account", label: "Disable account", target: "identity" },
  { id: "force_password_reset", label: "Force password reset", target: "identity" },
  { id: "revoke_tokens", label: "Revoke sessions & tokens", target: "identity" },
  { id: "block_sender", label: "Block sender / domain", target: "mailbox" },
  { id: "block_ip", label: "Block IP at egress", target: "device" },
];

// Maps a search result's entityType to the eventTable string the evidence/timeline endpoints
// expect (apps/api's EvidenceCollection/TimelineItem rows are keyed by this table name).
const EVENT_TABLE_BY_ENTITY_TYPE: Record<SearchEntityType, string> = {
  sign_in_event: "sign_in_events",
  email_message: "email_messages",
  cloud_event: "cloud_events",
  process_event: "process_events",
  file_event: "file_events",
  network_event: "network_events",
  http_request: "http_requests",
};

function severityForEntity(
  entityType: SearchEntityType,
): "critical" | "high" | "medium" | "low" | "info" {
  // Search results don't carry a severity (only alerts do) — this is a display-only heuristic
  // so results don't all render identically, not a scoring signal.
  if (entityType === "process_event" || entityType === "network_event") return "high";
  if (entityType === "email_message" || entityType === "cloud_event") return "medium";
  return "info";
}

type Pivot = {
  kind: "email" | "identity" | "device";
  id: string;
  label: string;
  icon: typeof Mail;
};

/**
 * What an analyst can follow from a given event. Every telemetry row carries the ids of the
 * entities it belongs to (see apps/api's toStudent*Dto mappers), so each event type opens onto
 * the entity view that actually explains it: a sign-in onto the account, a process/file/network
 * event onto the machine, an email onto the message itself.
 */
function pivotsFor(entityType: SearchEntityType, data: Record<string, unknown>): Pivot[] {
  const pivots: Pivot[] = [];
  const identityId = typeof data.identityId === "string" ? data.identityId : null;
  const deviceId = typeof data.deviceId === "string" ? data.deviceId : null;

  if (entityType === "email_message") {
    pivots.push({ kind: "email", id: String(data.id), label: "Open message", icon: Mail });
  }
  if (identityId) {
    pivots.push({ kind: "identity", id: identityId, label: "View account", icon: UserRound });
  }
  if (deviceId) {
    pivots.push({
      kind: "device",
      id: deviceId,
      label: "View device",
      icon: MonitorSmartphone,
    });
  }
  return pivots;
}

function CaseWorkspace() {
  const { id: sessionId } = useParams({ from: "/app/cases/$id" });
  const readiness = useSessionReadiness(sessionId);

  if (readiness.isPending) {
    return <GeneratingScenario />;
  }
  if (readiness.isError) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-sm text-secondary">
          {readiness.error instanceof ApiError
            ? readiness.error.message
            : "Could not load this session."}
        </p>
        <Link
          to="/app/scenarios"
          className="mt-3 inline-block text-[13px] text-[color:var(--info)]"
        >
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
        <Link
          to="/app/scenarios"
          className="mt-3 inline-block text-[13px] text-[color:var(--info)]"
        >
          Back to Scenario Library
        </Link>
      </div>
    );
  }

  return <CaseWorkspaceInner sessionId={sessionId} incidentId={incidentSummary.id} />;
}

function CaseWorkspaceInner({ sessionId, incidentId }: { sessionId: string; incidentId: string }) {
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
    closeIncidentError,
    submitSession,
    search,
    searching,
    lookupThreatIntel,
    lookingUpThreatIntel,
  } = useInvestigation(sessionId, incidentId);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchEntityType | "all">("all");
  const [results, setResults] = useState<
    { entityType: SearchEntityType; occurredAt: string; data: Record<string, unknown> }[]
  >([]);

  // Counts come from the unfiltered set so the chips stay stable as you switch between them —
  // a filter whose own label changes the moment you apply it is disorienting.
  const typeCounts = Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      acc[r.entityType] = (acc[r.entityType] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]) as [SearchEntityType, number][];

  const visibleResults =
    typeFilter === "all" ? results : results.filter((r) => r.entityType === typeFilter);

  const [note, setNote] = useState("");
  const [verdict, setVerdict] = useState<IncidentVerdict | undefined>(undefined);
  const [summary, setSummary] = useState("");
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<string[]>([]);
  const [takenActions, setTakenActions] = useState<ResponseActionType[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [tiType, setTiType] = useState<"hash" | "ip" | "domain" | "url">("ip");
  const [tiValue, setTiValue] = useState("");
  const [tiResult, setTiResult] = useState<Awaited<ReturnType<typeof lookupThreatIntel>> | null>(
    null,
  );
  const [tiError, setTiError] = useState<string | null>(null);
  // Which email the analyst has opened, if any — the case workspace's read-the-actual-message
  // pivot (see EmailDetailDrawer).
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [openIdentityId, setOpenIdentityId] = useState<string | null>(null);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  // Already fetched by CaseWorkspace's readiness gate — react-query dedupes on the same key,
  // so this is a cache read, not a second request.
  const { data: session } = useSessionReadiness(sessionId);

  // Debounced — every keystroke would otherwise fire a real network call, unlike the old
  // Identities now carry a month of routine sign-ins, which is what makes "unusual for this
  // account" a judgement an investigator can actually make — but it also means the raw feed is
  // mostly baseline. Filtering by type is how you get from that to the handful of events a
  // scenario turns on, without having to guess a freetext term first.
  // mock's instant client-side filter over a static array.
  useEffect(() => {
    const handle = setTimeout(() => {
      search(query.trim() ? { freetext: query.trim() } : {})
        .then(setResults)
        .catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `search` is a stable mutateAsync ref
  }, [query]);

  const locked = incident?.status === "closed";
  const pinnedIds = new Set(evidence.map((e) => `${e.eventTable}:${e.eventId}`));
  const timelineIds = new Set(timeline.map((t) => `${t.eventTable}:${t.id}`));
  const nextHint = hints.find((h) => !h.unlocked);

  if (incidentLoading || !incident) {
    return <GeneratingScenario />;
  }

  async function handleClose() {
    setFormError(null);
    if (!verdict) return setFormError("Select a verdict before submitting.");
    if (summary.trim().length < 20) {
      return setFormError("The written summary must be at least 20 characters.");
    }
    if (selectedTechniqueIds.length === 0) {
      return setFormError("Tag at least one MITRE technique.");
    }
    try {
      await closeIncident({
        verdict,
        summary: summary.trim(),
        mitreTechniqueIds: selectedTechniqueIds,
      });
      await submitSession();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not submit this incident. Try again.",
      );
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/app/scenarios"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Scenario Library
      </Link>

      <SectionHeader
        title={session?.scenarioTitle ?? incident.title}
        description={`${incident.linkedAlertIds.length} linked alerts`}
        actions={
          locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-secondary">
              <Lock className="size-3" /> Locked
            </span>
          ) : undefined
        }
      />

      {/* Case briefing — what you're being asked to look into. Deliberately only the public
       * scenario summary; the ground truth's own narrative of what actually happened never
       * reaches the client. */}
      {session && (
        <Panel className="mb-4">
          <div className="flex items-start gap-3">
            <IconTile tone="info" size="md">
              <FileText className="size-4" />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Case briefing
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-secondary">
                {session.scenarioSummary}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                <span className="rounded border border-border bg-background px-1.5 py-0.5 capitalize text-muted-foreground">
                  {session.scenarioCategory}
                </span>
                <span className="rounded border border-border bg-background px-1.5 py-0.5 capitalize text-muted-foreground">
                  {session.scenarioDifficulty}
                </span>
                <span className="rounded border border-border bg-background px-1.5 py-0.5 text-muted-foreground">
                  ~{session.estimatedMinutes} min
                </span>
              </div>
              <p className="mt-2.5 text-[11.5px] text-muted-foreground">
                Work the evidence below, pin what matters, build your timeline, then close the
                incident with a verdict. Open any email to read it in full and trace who else
                received it.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <Panel
            title="Session telemetry"
            actions={
              <span className="text-[11px] text-muted-foreground">
                {searching
                  ? "Searching…"
                  : typeFilter === "all"
                    ? `${results.length} events`
                    : `${visibleResults.length} of ${results.length} events`}
              </span>
            }
            padded={false}
          >
            <div className="border-b border-border p-3">
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px]">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent focus:outline-none"
                  placeholder="Freetext search across identity, endpoint, email, and cloud telemetry…"
                />
              </div>

              {typeCounts.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([["all", `All ${results.length}`]] as [SearchEntityType | "all", string][])
                    .concat(typeCounts.map(([t, n]) => [t, `${ENTITY_TYPE_LABEL[t] ?? t} ${n}`]))
                    .map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setTypeFilter(value)}
                        className={`rounded-full border px-2.5 py-1 text-[10.5px] transition-colors ${
                          typeFilter === value
                            ? "border-[color:var(--info)] bg-[color:var(--info)]/12 text-[color:var(--info)]"
                            : "border-border text-secondary hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
              {visibleResults.map((r) => {
                const eventTable = EVENT_TABLE_BY_ENTITY_TYPE[r.entityType];
                const eventId = String(r.data.id);
                const key = `${eventTable}:${eventId}`;
                const isPinned = pinnedIds.has(key);
                const onTimeline = timelineIds.has(key);
                return (
                  <li
                    key={key}
                    className={`px-4 py-3 ${
                      isPinned
                        ? "border-l-2 border-[color:var(--success)] bg-[color:var(--success)]/[0.04]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-medium">
                            {labelForResult(r.entityType, r.data)}
                          </span>
                          <SeverityBadge level={severityForEntity(r.entityType)} />
                          {isPinned && (
                            <span className="inline-flex items-center gap-1 rounded border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--success)]">
                              <Pin className="size-2.5" /> Evidence
                            </span>
                          )}
                          {onTimeline && (
                            <span className="inline-flex items-center gap-1 rounded border border-[color:var(--info)]/40 bg-[color:var(--info)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--info)]">
                              <ListTree className="size-2.5" /> On timeline
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-secondary">
                          {detailForResult(r.entityType, r.data)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                          <span>{new Date(r.occurredAt).toUTCString().slice(5, 22)} UTC</span>
                          {pivotsFor(r.entityType, r.data).map((p) => (
                            <button
                              key={p.label}
                              onClick={() =>
                                p.kind === "email"
                                  ? setOpenEmailId(p.id)
                                  : p.kind === "identity"
                                    ? setOpenIdentityId(p.id)
                                    : setOpenDeviceId(p.id)
                              }
                              className="inline-flex items-center gap-1 rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 text-[10.5px] text-[color:var(--info)] hover:bg-[color:var(--info)]/10"
                            >
                              <p.icon className="size-3" /> {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          disabled={locked}
                          onClick={() =>
                            isPinned
                              ? (() => {
                                  // Pinning is a toggle, not a one-way action — an analyst
                                  // narrowing down a case needs to drop evidence they pinned
                                  // during triage, and evidence precision is scored.
                                  const existing = evidence.find(
                                    (e) => e.eventTable === eventTable && e.eventId === eventId,
                                  );
                                  if (existing) removeEvidence(existing.id);
                                })()
                              : pinEvidence({
                                  eventTable,
                                  eventId,
                                  justification: "Pinned during triage",
                                })
                          }
                          title={isPinned ? "Remove from evidence" : "Pin as evidence"}
                          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40 ${
                            isPinned
                              ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/10 text-[color:var(--success)] hover:border-[color:var(--critical)]/50 hover:text-[color:var(--critical)]"
                              : "border-border bg-background text-secondary hover:text-foreground"
                          }`}
                        >
                          {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                          {isPinned ? "Pinned" : "Pin"}
                        </button>
                        <button
                          disabled={locked}
                          onClick={() =>
                            onTimeline
                              ? removeFromTimeline({ eventTable, eventId })
                              : addToTimeline({ eventTable, eventId })
                          }
                          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40 ${
                            onTimeline
                              ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/10"
                              : "border-border bg-background text-secondary hover:text-foreground"
                          }`}
                        >
                          <ListTree className="size-3" /> {onTimeline ? "On timeline" : "Timeline"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {results.length === 0 && !searching && (
                <li className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                  {query.trim()
                    ? "No matching telemetry."
                    : "Type to search this session's telemetry."}
                </li>
              )}
            </ul>
          </Panel>

          {/* Evidence locker */}
          <Panel
            title="Evidence collection"
            actions={
              <span className="text-[11px] text-muted-foreground">{evidence.length} pinned</span>
            }
            padded={false}
          >
            {evidence.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Nothing pinned yet. Pin the events that prove your conclusion — precision is scored,
                so noise costs you.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {evidence.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Paperclip className="size-3.5 text-[color:var(--info)]" />
                          <span className="text-[12.5px] font-medium">
                            {item.display?.title ?? "(details not loaded — found via search)"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11.5px] text-secondary">
                          {item.display?.summary}
                        </p>
                      </div>
                      <button
                        disabled={locked}
                        onClick={() => removeEvidence(item.id)}
                        className="grid size-7 shrink-0 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Timeline */}
          <Panel title="Incident timeline" padded={false}>
            {timeline.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Add events to reconstruct the attack chain in order.
              </div>
            ) : (
              <ol className="relative ml-6 border-l border-border py-3 pr-4">
                {timeline.map((t) => (
                  <li key={t.id} className="relative py-2 pl-5">
                    <span className="absolute -left-[5px] top-4 size-2 rounded-full bg-[color:var(--info)]" />
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {new Date(t.occurredAt).toISOString().slice(11, 16)} UTC
                      </span>
                      <span className="font-medium">{t.entityLabel}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-secondary">{t.summary}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Response actions */}
          <Panel title="Response actions">
            <p className="mb-3 text-[11.5px] text-secondary">
              Containment is scored. Taking the wrong action — or the right one too late — affects
              your rubric.
            </p>
            <div className="flex flex-col gap-1.5">
              {RESPONSE_ACTIONS.map((a) => {
                const taken = takenActions.includes(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={locked || taken}
                    onClick={async () => {
                      await logResponseAction({ actionType: a.id, targetType: a.target });
                      setTakenActions((prev) => [...prev, a.id]);
                    }}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] transition-colors disabled:opacity-60 ${
                      taken
                        ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                        : "border-border bg-background hover:border-[color:var(--info)]/50"
                    }`}
                  >
                    {taken ? <CheckCircle2 className="size-3.5" /> : <Zap className="size-3.5" />}
                    <span className="flex-1 text-left">{a.label}</span>
                  </button>
                );
              })}
            </div>
          </Panel>

          {/* Threat intel lookup */}
          <Panel title="Threat intelligence lookup">
            <p className="mb-3 text-[11.5px] text-secondary">
              Check whether an IP, domain, hash, or URL you found is a known indicator in this
              investigation.
            </p>
            <div className="flex gap-2">
              <select
                value={tiType}
                onChange={(e) => setTiType(e.target.value as typeof tiType)}
                className="h-9 rounded-md border border-border bg-background px-2 text-[12px]"
              >
                <option value="ip">IP</option>
                <option value="domain">Domain</option>
                <option value="hash">Hash</option>
                <option value="url">URL</option>
              </select>
              <input
                value={tiValue}
                onChange={(e) => setTiValue(e.target.value)}
                placeholder="e.g. 185.220.101.44"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[12px]"
              />
            </div>
            <button
              disabled={!tiValue.trim() || lookingUpThreatIntel}
              onClick={async () => {
                setTiError(null);
                try {
                  const result = await lookupThreatIntel({
                    type: tiType,
                    value: tiValue.trim(),
                  });
                  setTiResult(result);
                } catch (err) {
                  setTiError(err instanceof ApiError ? err.message : "Lookup failed.");
                }
              }}
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] hover:border-[color:var(--info)]/50 disabled:opacity-60"
            >
              {lookingUpThreatIntel ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Radar className="size-3.5" />
              )}
              Look up
            </button>
            {tiResult && (
              <div className="mt-3 rounded-md border border-border bg-background p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono">{tiResult.value}</span>
                  <SeverityBadge level={REPUTATION_SEVERITY[tiResult.reputation]} />
                </div>
                {tiResult.actorAttribution && (
                  <div className="mt-1 text-secondary">
                    Attributed to {tiResult.actorAttribution}
                  </div>
                )}
                {tiResult.context && (
                  <div className="mt-1 text-muted-foreground">{tiResult.context}</div>
                )}
              </div>
            )}
            {tiError && (
              <p className="mt-2 text-[11.5px] text-[color:var(--critical)]">{tiError}</p>
            )}
          </Panel>

          {/* Notes */}
          <Panel title="Analyst notes" padded={false}>
            <div className="max-h-56 overflow-y-auto px-4 py-3">
              {notes.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  Your working memory. Not graded, but retained for review.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <div className="text-[10.5px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-secondary">
                        {n.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border p-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={locked}
                placeholder="Add a note…"
                className="w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] focus:outline-none disabled:opacity-40"
              />
              <button
                disabled={locked || !note.trim()}
                onClick={() => {
                  addNote(note.trim());
                  setNote("");
                }}
                className="mt-2 h-8 w-full rounded-md bg-primary text-[12px] font-medium text-primary-foreground disabled:opacity-40"
              >
                Save note
              </button>
            </div>
          </Panel>

          {/* Hints */}
          <Panel title="Hints">
            <p className="text-[11.5px] text-secondary">
              Each hint costs points. Unlocked:{" "}
              <span className="tabular-nums">{hints.filter((h) => h.unlocked).length}</span> /{" "}
              {hints.length}
            </p>
            <button
              disabled={locked || !nextHint}
              onClick={() => nextHint && unlockHint(nextHint.index)}
              className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] text-secondary hover:text-foreground disabled:opacity-40"
            >
              <Lightbulb className="size-3.5" />
              {nextHint ? `Reveal hint (−${nextHint.unlockCostPercent}%)` : "All hints revealed"}
            </button>
            {hints
              .filter((h) => h.unlocked)
              .map((h) => (
                <p
                  key={h.index}
                  className="mt-2 rounded-md border border-border bg-background p-2 text-[11.5px] text-secondary"
                >
                  {h.text}
                </p>
              ))}
          </Panel>

          {/* Closure */}
          <Panel title="Submit verdict">
            {locked ? (
              <ScoreResult sessionId={sessionId} incidentId={incident?.id} />
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {VERDICTS.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVerdict(v.id)}
                      className={`rounded-md border px-3 py-2 text-left transition-colors ${
                        verdict === v.id
                          ? "border-[color:var(--info)]/60 bg-[color:var(--info)]/10"
                          : "border-border bg-background hover:border-border/80"
                      }`}
                    >
                      <div className="text-[12.5px] font-medium">{v.label}</div>
                      <div className="text-[10.5px] text-muted-foreground">{v.hint}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="t-label mb-1.5">MITRE techniques</div>
                  <div className="flex flex-wrap gap-1.5">
                    {mitreTechniques.map((t) => {
                      const on = selectedTechniqueIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setSelectedTechniqueIds((prev) =>
                              on ? prev.filter((id) => id !== t.id) : [...prev, t.id],
                            )
                          }
                          title={`${t.name} · ${t.tactic}`}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10.5px] ${
                            on
                              ? "border-[color:var(--info)]/60 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                              : "border-border bg-background text-secondary"
                          }`}
                        >
                          {t.techniqueId}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="t-label mb-1.5">Written summary</div>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={5}
                    placeholder="What happened, how you know, and what you did about it…"
                    className="w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] focus:outline-none"
                  />
                  <div className="mt-1 text-right text-[10.5px] text-muted-foreground">
                    {summary.trim().length}/20 min
                  </div>
                </div>

                {(formError || closeIncidentError) && (
                  <p className="mt-2 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-2 text-[11.5px]">
                    {formError ??
                      (closeIncidentError instanceof ApiError
                        ? closeIncidentError.message
                        : "Could not submit.")}
                  </p>
                )}

                <button
                  onClick={handleClose}
                  disabled={closingIncident}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-[12.5px] font-medium text-primary-foreground disabled:opacity-60"
                >
                  {closingIncident ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Submit and score
                </button>
                <p className="mt-2 text-[10.5px] text-muted-foreground">
                  Submitting locks the case. Only an instructor can reopen it.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>

      {openEmailId && (
        <EmailDetailDrawer
          sessionId={sessionId}
          emailId={openEmailId}
          onClose={() => setOpenEmailId(null)}
          onPin={(input) => pinEvidence(input)}
          isPinned={pinnedIds.has(`email_messages:${openEmailId}`)}
          onUnpin={() => {
            const pinned = evidence.find(
              (e) => e.eventTable === "email_messages" && e.eventId === openEmailId,
            );
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
        />
      )}
      {openDeviceId && (
        <DeviceDetailDrawer
          sessionId={sessionId}
          deviceId={openDeviceId}
          onClose={() => setOpenDeviceId(null)}
          locked={locked}
        />
      )}
    </div>
  );
}

function ScoreResult({
  sessionId,
  incidentId,
}: {
  sessionId: string;
  incidentId: string | undefined;
}) {
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
    <div>
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

      {/* Instructor review, kept visually distinct from the automated rubric above — §2.15
       * asks for the two to be distinctly attributed, and a human's comment carries different
       * weight to a computed percentage. */}
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
