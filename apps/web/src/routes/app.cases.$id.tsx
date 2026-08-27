import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Panel, SectionHeader, SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { HydrationBoundary } from "@/components/soc/ui/hydration-boundary";
import { EntityTypeIcon } from "@/components/soc/ui/entity-icon";
import { useInvestigation } from "@/hooks/use-investigations";
import type { CaseStatus, CaseVerdict } from "@/types/investigations";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lightbulb,
  ListTree,
  Lock,
  Paperclip,
  Pin,
  PinOff,
  Search,
  ShieldCheck,
  Target,
  Trash2,
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
          "Work a single incident end to end: evidence locker, global timeline, analyst notes, response actions, and scored verdict submission.",
      },
      { property: "og:title", content: "Case Management — ThreatLens" },
      {
        property: "og:description",
        content:
          "Evidence locker, timeline reconstruction, containment actions, and rubric-based scoring.",
      },
    ],
  }),
});

const statusFlow: CaseStatus[] = ["open", "investigating", "contained", "closed"];

const verdicts: { id: CaseVerdict; label: string; hint: string }[] = [
  { id: "true-positive", label: "True positive", hint: "Malicious activity confirmed with impact" },
  {
    id: "false-positive",
    label: "False positive",
    hint: "Detection fired on non-malicious activity",
  },
  {
    id: "benign-positive",
    label: "Benign positive",
    hint: "Real malicious signal, no impact realised",
  },
];

function CaseWorkspace() {
  const { id } = useParams({ from: "/app/cases/$id" });
  // Mock-only session-expiry simulation — a real API adapter would surface
  // this as a 401 from any mutation and the frontend would redirect here.
  // Try /app/cases/EXPIRED to see the state.
  if (id === "EXPIRED") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-lg bg-[color:var(--warning)]/12 text-[color:var(--warning)]">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-4 text-[15px] font-semibold">Your session has expired</h2>
          <p className="mt-1.5 text-[12.5px] text-secondary">
            For your security, please log in again to continue this investigation.
          </p>
          <Link to="/login" className="btn-primary mt-5 w-full justify-center py-2.5">
            Log in again
          </Link>
        </div>
      </div>
    );
  }
  return (
    <HydrationBoundary>
      <CaseWorkspaceInner />
    </HydrationBoundary>
  );
}

function CaseWorkspaceInner() {
  const { id } = useParams({ from: "/app/cases/$id" });
  const {
    incident,
    caseState: c,
    linkedAlerts: alerts,
    minEvidence,
    hint,
    mitreTechniques,
    responseActions,
    searchTelemetry,
    eventById,
    setCaseStatus,
    pinEvidence,
    unpinEvidence,
    tagEvidence,
    addToTimeline,
    removeFromTimeline,
    addCaseNote,
    toggleTechniqueTag,
    setCaseSummary,
    useHint: revealHint,
    logAction,
    submitCase,
  } = useInvestigation(id);

  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [verdict, setVerdict] = useState<CaseVerdict | undefined>(c.verdict);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(c.submittedAt) && c.status === "closed";
  const hintText = hint(c.hintsUsed);

  const results = searchTelemetry(query);
  const pinnedIds = c.evidence.map((e) => e.eventId);

  if (!incident) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-sm text-secondary">Case {id} was not found in this session.</p>
        <Link
          to="/app/incidents"
          className="mt-3 inline-block text-[13px] text-[color:var(--info)]"
        >
          Back to Incident Queue
        </Link>
      </div>
    );
  }

  const onSubmit = () => {
    if (!verdict) return setError("Select a verdict before submitting.");
    if (c.summary.trim().length < 80)
      return setError(
        "The written summary must be at least 80 characters — describe what happened and why.",
      );
    if (c.techniqueTags.length === 0) return setError("Tag at least one MITRE technique.");
    if (c.evidence.length < minEvidence)
      return setError(`This scenario requires at least ${minEvidence} pinned evidence items.`);
    setError(null);
    submitCase(verdict);
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/app/incidents"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Incident Queue
      </Link>

      <SectionHeader
        title={incident.title}
        description={`${incident.id} · ${incident.alerts} linked alerts · ${incident.entities} entities · owner ${incident.owner}`}
        actions={
          <div className="flex items-center gap-2">
            <SeverityBadge level={incident.severity} />
            {locked && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-secondary">
                <Lock className="size-3" /> Locked
              </span>
            )}
          </div>
        }
      />

      {/* Status state machine */}
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-label mr-1">Case status</span>
          {statusFlow.map((st) => {
            const active = c.status === st || (st === "closed" && c.status === "closed");
            return (
              <button
                key={st}
                disabled={locked}
                onClick={() => setCaseStatus(st)}
                className={`h-8 rounded-md border px-3 text-[12px] capitalize transition-colors disabled:opacity-40 ${
                  active
                    ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                    : "border-border bg-background text-secondary hover:text-foreground"
                }`}
              >
                {st}
              </button>
            );
          })}
          {c.status === "reopened" && <StatusBadge status="in-progress" />}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3.5" />
            {c.statusHistory.length
              ? `${c.statusHistory.length} transitions logged`
              : "No transitions yet"}
          </span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          {/* Evidence search */}
          <Panel
            title="Session telemetry"
            actions={
              <span className="text-[11px] text-muted-foreground">{results.length} events</span>
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
                  placeholder="Freetext, or field=value — entity=sarah.chen, source=Entra ID, mitre=T1528"
                />
              </div>
            </div>
            <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
              {results.map((e) => {
                const isPinned = pinnedIds.includes(e.id);
                const onTimeline = c.timeline.includes(e.id);
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10.5px] text-muted-foreground">
                            {e.id}
                          </span>
                          <span className="text-[12.5px] font-medium">{e.action}</span>
                          <SeverityBadge level={e.severity} />
                          {e.mitre && (
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-secondary">
                              {e.mitre}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-secondary">
                          {e.detail}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                          <span>{new Date(e.ts).toUTCString().slice(5, 22)} UTC</span>
                          <span>·</span>
                          <span>{e.source}</span>
                          <span>·</span>
                          <span className="font-mono">{e.entity}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          disabled={locked}
                          onClick={() =>
                            isPinned
                              ? unpinEvidence(e.id)
                              : pinEvidence(e.id, "Pinned during triage")
                          }
                          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40 ${
                            isPinned
                              ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                              : "border-border bg-background text-secondary hover:text-foreground"
                          }`}
                        >
                          {isPinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
                          {isPinned ? "Pinned" : "Pin"}
                        </button>
                        <button
                          disabled={locked}
                          onClick={() =>
                            onTimeline ? removeFromTimeline(e.id) : addToTimeline(e.id)
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
            </ul>
          </Panel>

          {/* Evidence locker */}
          <Panel
            title="Evidence collection"
            actions={
              <span className="text-[11px] text-muted-foreground">
                {c.evidence.length} pinned · min {minEvidence}
              </span>
            }
            padded={false}
          >
            {c.evidence.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Nothing pinned yet. Pin the events that prove your conclusion — precision is scored,
                so noise costs you.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {c.evidence.map((item) => {
                  const ev = eventById(item.eventId);
                  return (
                    <li key={item.eventId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Paperclip className="size-3.5 text-[color:var(--info)]" />
                            <span className="font-mono text-[10.5px] text-muted-foreground">
                              {item.eventId}
                            </span>
                            <span className="text-[12.5px] font-medium">{ev?.action}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11.5px] text-secondary">
                            {ev?.detail}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <select
                            disabled={locked}
                            value={item.technique ?? ""}
                            onChange={(e) => tagEvidence(item.eventId, e.target.value)}
                            className="h-7 rounded border border-border bg-background px-1.5 font-mono text-[10.5px] disabled:opacity-40"
                          >
                            <option value="">Tag technique…</option>
                            {mitreTechniques.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.id}
                              </option>
                            ))}
                          </select>
                          <button
                            disabled={locked}
                            onClick={() => unpinEvidence(item.eventId)}
                            className="grid size-7 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Incident timeline */}
          <Panel title="Incident timeline" padded={false}>
            {c.timeline.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                Add events to reconstruct the attack chain in order.
              </div>
            ) : (
              <ol className="relative ml-6 border-l border-border py-3 pr-4">
                {c.timeline
                  .map((eid) => eventById(eid))
                  .filter(Boolean)
                  .sort((a, b) => a!.ts.localeCompare(b!.ts))
                  .map((e) => (
                    <li key={e!.id} className="relative py-2 pl-5">
                      <span className="absolute -left-[5px] top-4 size-2 rounded-full bg-[color:var(--info)]" />
                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          {e!.ts.slice(11, 16)} UTC
                        </span>
                        <span className="font-medium">{e!.action}</span>
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <EntityTypeIcon type={e!.entityType} />
                          {e!.entityType}
                        </span>
                        {e!.correlationId && (
                          <span className="rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--info)]">
                            {e!.correlationId}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-secondary">{e!.detail}</p>
                    </li>
                  ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-4">
          {/* Linked alerts */}
          {alerts.length > 0 && (
            <Panel title="Linked alerts" padded={false}>
              <ul className="divide-y divide-border">
                {alerts.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-[12px]">
                    <div className="font-medium">{a.name}</div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {a.id}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Response actions */}
          <Panel title="Response actions">
            <p className="mb-3 text-[11.5px] text-secondary">
              Containment is scored. Taking the wrong action — or the right one too late — affects
              your rubric.
            </p>
            <div className="flex flex-col gap-1.5">
              {responseActions.map((a) => {
                const taken = c.actions.some((x) => x.actionId === a.id);
                return (
                  <button
                    key={a.id}
                    disabled={locked || taken}
                    onClick={() => logAction({ actionId: a.id, label: a.label, target: a.target })}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] transition-colors disabled:opacity-60 ${
                      taken
                        ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
                        : "border-border bg-background hover:border-[color:var(--info)]/50"
                    }`}
                  >
                    {taken ? <CheckCircle2 className="size-3.5" /> : <Zap className="size-3.5" />}
                    <span className="flex-1 text-left">{a.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{a.target}</span>
                  </button>
                );
              })}
            </div>
            {c.actions.length > 0 && (
              <ul className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {c.actions.map((a) => (
                  <li key={a.id} className="py-0.5">
                    {a.ts} · {a.actor} · {a.label}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Analyst notes */}
          <Panel title="Analyst notes" padded={false}>
            <div className="max-h-56 overflow-y-auto px-4 py-3">
              {c.notes.length === 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  Your working memory. Not graded, but retained for review and replay.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {c.notes.map((n) => (
                    <li key={n.id}>
                      <div className="text-[10.5px] text-muted-foreground">
                        {n.author} · {n.ts}
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
                placeholder="Add a timestamped note…"
                className="w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] focus:outline-none disabled:opacity-40"
              />
              <button
                disabled={locked || !note.trim()}
                onClick={() => {
                  addCaseNote(note.trim());
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
              Each hint costs 5 points. Used: <span className="tabular-nums">{c.hintsUsed}</span>
            </p>
            <button
              disabled={locked}
              onClick={() => revealHint()}
              className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] text-secondary hover:text-foreground disabled:opacity-40"
            >
              <Lightbulb className="size-3.5" /> Reveal a hint
            </button>
            {hintText && (
              <p className="mt-2 rounded-md border border-border bg-background p-2 text-[11.5px] text-secondary">
                {hintText}
              </p>
            )}
          </Panel>

          {/* Closure */}
          <Panel title="Submit verdict">
            {locked && c.score ? (
              <ScoreResult incidentId={id} />
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  {verdicts.map((v) => (
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
                      const on = c.techniqueTags.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTechniqueTag(t.id)}
                          title={`${t.name} · ${t.tactic}`}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10.5px] ${
                            on
                              ? "border-[color:var(--info)]/60 bg-[color:var(--info)]/10 text-[color:var(--info)]"
                              : "border-border bg-background text-secondary"
                          }`}
                        >
                          {t.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="t-label mb-1.5">Written summary</div>
                  <textarea
                    value={c.summary}
                    onChange={(e) => setCaseSummary(e.target.value)}
                    rows={5}
                    placeholder="What happened, how you know, and what you did about it…"
                    className="w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] focus:outline-none"
                  />
                  <div className="mt-1 text-right text-[10.5px] text-muted-foreground">
                    {c.summary.trim().length}/80 min
                  </div>
                </div>

                {error && (
                  <p className="mt-2 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-2 text-[11.5px]">
                    {error}
                  </p>
                )}

                <button
                  onClick={onSubmit}
                  className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-[12.5px] font-medium text-primary-foreground"
                >
                  <ShieldCheck className="size-4" /> Submit and score
                </button>
                <p className="mt-2 text-[10.5px] text-muted-foreground">
                  Submitting locks the case. Only an instructor can reopen it.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ScoreResult({ incidentId }: { incidentId: string }) {
  const { caseState: c, narrative, reopenCase } = useInvestigation(incidentId);
  const score = c.score!;

  const rubric = [
    { label: "Technique accuracy", value: score.techniqueAccuracy, weight: "30%" },
    { label: "Evidence recall", value: score.evidenceRecall, weight: "25%" },
    { label: "Evidence precision", value: score.evidencePrecision, weight: "15%" },
    { label: "Response actions", value: score.responseActions, weight: "15%" },
    { label: "Verdict", value: score.verdictCorrect ? 100 : 0, weight: "15%" },
  ];

  return (
    <div>
      <div className="flex items-end gap-3">
        <div className="t-metric">{score.total}</div>
        <div className="pb-1 text-[11.5px] text-muted-foreground">
          / 100 · scored {score.scoredAt}
          {score.hintPenalty > 0 && <> · −{score.hintPenalty} hints</>}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {rubric.map((r) => (
          <li key={r.label}>
            <div className="flex items-center justify-between text-[11.5px]">
              <span>
                {r.label} <span className="text-muted-foreground">({r.weight})</span>
              </span>
              <span className="tabular-nums">{r.value}%</span>
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

      <div className="mt-4 flex flex-col gap-2 text-[11.5px]">
        {score.missedEvidence.length > 0 && (
          <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 p-2">
            <div className="font-medium">Missed evidence</div>
            <div className="mt-1 font-mono text-[10.5px]">{score.missedEvidence.join(", ")}</div>
          </div>
        )}
        {score.noiseIncluded.length > 0 && (
          <div className="rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-2">
            <div className="font-medium">Noise you pinned</div>
            <div className="mt-1 font-mono text-[10.5px]">{score.noiseIncluded.join(", ")}</div>
          </div>
        )}
        {score.missedTechniques.length > 0 && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="font-medium">Techniques you did not tag</div>
            <div className="mt-1 font-mono text-[10.5px]">{score.missedTechniques.join(", ")}</div>
          </div>
        )}
        {narrative && (
          <div className="rounded-md border border-border bg-background p-2">
            <div className="flex items-center gap-1.5 font-medium">
              <Target className="size-3.5 text-[color:var(--info)]" /> What actually happened
            </div>
            <p className="mt-1 leading-relaxed text-secondary">{narrative}</p>
          </div>
        )}
      </div>

      {c.instructorFeedback ? (
        <div className="mt-3 rounded-md border border-[color:var(--info)]/40 bg-[color:var(--info)]/10 p-2 text-[11.5px]">
          <div className="font-medium">Instructor feedback</div>
          <p className="mt-1">{c.instructorFeedback.body}</p>
        </div>
      ) : (
        <button
          onClick={() =>
            reopenCase("Reopened for a second pass — revisit the exfiltration window.")
          }
          className="mt-3 h-8 w-full rounded-md border border-border bg-background text-[12px] text-secondary hover:text-foreground"
        >
          Instructor: reopen case
        </button>
      )}
    </div>
  );
}
