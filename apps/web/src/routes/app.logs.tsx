import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { SessionPicker } from "@/components/soc/session-picker";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useActiveSession } from "@/hooks/use-active-session";
import { useIdentities } from "@/hooks/use-identities";
import { useEndpoints } from "@/hooks/use-endpoints";
import { ENTITY_TYPE_META } from "@/hooks/use-search";
import { investigationsService } from "@/services/investigations";
import { labelForResult, detailForResult } from "@/lib/search-result-format";
import { formatEventTime } from "@/components/soc/entity-drawer-shell";
import { ChevronDown, ChevronRight, Loader2, Terminal, X } from "lucide-react";
import type { SearchEntityType, SearchResultItem } from "@/types/socverse-investigation";

export const Route = createFileRoute("/app/logs")({
  component: LogExplorer,
  head: () => ({ meta: [{ title: "ThreatLens · Log Explorer" }] }),
});

type FieldOption = { field: string; label: string };

// Mirrors apps/api/src/modules/search/search.service.ts's own field sets exactly — the backend
// doesn't expose this mapping, so it's kept here deliberately narrow rather than offering a
// free-text field name that would silently match nothing. Deliberately excludes any
// mitreTechniqueId-shaped filter for the same reason the backend itself refuses one: that field
// is the scenario's answer key (see the backend's own comment on SearchService).
const FIELD_OPTIONS: FieldOption[] = [
  { field: "sourceIp", label: "Source IP" },
  { field: "sourceCountry", label: "Source country" },
  { field: "sourceCity", label: "Source city" },
  { field: "application", label: "Application" },
  { field: "senderAddress", label: "Sender address" },
  { field: "subject", label: "Subject" },
  { field: "recipientAddress", label: "Recipient address" },
  { field: "resourceId", label: "Resource ID" },
  { field: "actionName", label: "Action name" },
  { field: "imagePath", label: "Process image path" },
  { field: "commandLine", label: "Command line" },
  { field: "filePath", label: "File path" },
  { field: "remoteIp", label: "Remote IP" },
  { field: "url", label: "URL" },
];

type TimeRange = "all" | "1h" | "6h" | "24h";
const TIME_RANGE_MS: Record<Exclude<TimeRange, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

/**
 * Log Explorer — a raw, structured query surface over one investigation's own telemetry.
 * Global Search (app.search.tsx) answers "where did this term show up, across every
 * investigation I've ever run" with a single freetext box; this answers "show me every
 * sign-in from this IP, or every process with this command line, in *this* investigation" —
 * field=value filtering, one session at a time, which is what an analyst reaches for once
 * they already know what they're looking for rather than searching for a keyword.
 *
 * Built entirely on the existing POST /sessions/:sessionId/search endpoint (see
 * useInvestigation's `search` mutation, already used by the case workspace's own lighter
 * freetext panel) — no new backend surface. Time-range is applied client-side to the results
 * that come back, per the backend's own comment on why it doesn't index occurredAt as a
 * filterable range: the per-type cap (100 rows, newest first) already bounds the query, and a
 * client-side window over an already-small, already-sorted set doesn't need a new endpoint
 * parameter to be exact.
 */
function LogExplorer() {
  const { isLoading: sessionsLoading, activeSessions, selectedSessionId, setSelectedSessionId } =
    useActiveSession();

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Log Explorer" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!selectedSessionId) {
    return <NoActiveSession title="Log Explorer" />;
  }

  return (
    <LogExplorerInner
      sessionId={selectedSessionId}
      activeSessions={activeSessions}
      selectedSessionId={selectedSessionId}
      setSelectedSessionId={setSelectedSessionId}
    />
  );
}

function LogExplorerInner({
  sessionId,
  activeSessions,
  selectedSessionId,
  setSelectedSessionId,
}: {
  sessionId: string;
  activeSessions: ReturnType<typeof useActiveSession>["activeSessions"];
  selectedSessionId: string | undefined;
  setSelectedSessionId: (id: string) => void;
}) {
  const { data: sessionIdentities } = useIdentities(sessionId);
  const { data: sessionDevices } = useEndpoints(sessionId);
  const nameFor = useMemo(() => {
    const byId = new Map<string, string>();
    for (const i of sessionIdentities ?? []) byId.set(i.id, i.displayName);
    for (const d of sessionDevices ?? []) byId.set(d.id, d.hostname);
    return (id: string) => byId.get(id);
  }, [sessionIdentities, sessionDevices]);

  const [field, setField] = useState(FIELD_OPTIONS[0].field);
  const [fieldValue, setFieldValue] = useState("");
  const [filters, setFilters] = useState<{ field: string; value: string }[]>([]);
  const [freetext, setFreetext] = useState("");
  const [entityFilter, setEntityFilter] = useState<SearchEntityType | "all">("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const search = useMutation({
    mutationFn: (input: { filters?: { field: string; value: string }[]; freetext?: string }) =>
      investigationsService.search(sessionId, input),
  });

  const addFilter = () => {
    if (!fieldValue.trim()) return;
    setFilters((prev) => [...prev, { field, value: fieldValue.trim() }]);
    setFieldValue("");
  };
  const removeFilter = (index: number) =>
    setFilters((prev) => prev.filter((_, i) => i !== index));

  // Debounced, same pattern as the case workspace's own search panel — every keystroke in the
  // freetext box would otherwise fire a real query.
  useEffect(() => {
    const handle = setTimeout(() => {
      search.mutateAsync({ filters, freetext: freetext.trim() || undefined })
        .then(setResults)
        .catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `search` is a stable mutateAsync ref
  }, [filters, freetext, sessionId]);

  const windowed =
    timeRange === "all"
      ? results
      : results.filter(
          (r) => Date.now() - new Date(r.occurredAt).getTime() <= TIME_RANGE_MS[timeRange],
        );

  const typeCounts = new Map<SearchEntityType, number>();
  for (const r of windowed) typeCounts.set(r.entityType, (typeCounts.get(r.entityType) ?? 0) + 1);

  const visible = entityFilter === "all" ? windowed : windowed.filter((r) => r.entityType === entityFilter);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Log Explorer"
        description="Structured, field=value queries over this investigation's raw telemetry."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />

      <Panel title="Query" className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.field} value={f.field}>
                {f.label}
              </option>
            ))}
          </select>
          <input
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFilter()}
            placeholder="Value to match…"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12.5px] font-mono outline-none placeholder:font-sans focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={addFilter}
            disabled={!fieldValue.trim()}
            className="btn-app-secondary disabled:opacity-50"
          >
            Add filter
          </button>
        </div>

        {filters.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {filters.map((f, i) => {
              const label = FIELD_OPTIONS.find((o) => o.field === f.field)?.label ?? f.field;
              return (
                <span
                  key={`${f.field}-${f.value}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                >
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-mono">{f.value}</span>
                  <button
                    onClick={() => removeFilter(i)}
                    aria-label={`Remove filter ${label}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <input
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            placeholder="…or search free text across subjects, commands, URLs"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search.isPending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>
      </Panel>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setEntityFilter("all")}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
            entityFilter === "all"
              ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-foreground"
              : "border-border bg-background text-secondary hover:text-foreground"
          }`}
        >
          All <span className="rounded bg-card px-1 text-[10px] text-muted-foreground">{windowed.length}</span>
        </button>
        {(Object.keys(ENTITY_TYPE_META) as SearchEntityType[])
          .filter((t) => (typeCounts.get(t) ?? 0) > 0)
          .map((t) => {
            const meta = ENTITY_TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setEntityFilter(entityFilter === t ? "all" : t)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                  entityFilter === t
                    ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-foreground"
                    : "border-border bg-background text-secondary hover:text-foreground"
                }`}
              >
                <meta.icon className="size-3.5" /> {meta.label}
                <span className="rounded bg-card px-1 text-[10px] text-muted-foreground">
                  {typeCounts.get(t) ?? 0}
                </span>
              </button>
            );
          })}
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {(["all", "1h", "6h", "24h"] as TimeRange[]).map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`rounded px-2 py-1 text-[11px] transition-colors ${
                timeRange === tr
                  ? "bg-[color:var(--info)]/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tr === "all" ? "All time" : `Last ${tr}`}
            </button>
          ))}
        </div>
      </div>

      <Panel padded={false}>
        {search.isPending && results.length === 0 ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Terminal className="size-6" />}
            title="No matching events"
            description="Add a filter, adjust the time window, or clear the query to see everything captured for this investigation."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((r, i) => {
              const meta = ENTITY_TYPE_META[r.entityType];
              const open = expanded === i;
              return (
                <li key={i}>
                  <button
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-background/40"
                  >
                    <IconTile size="sm">
                      <meta.icon className="size-3" />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">
                        {labelForResult(r.entityType, r.data)}
                      </div>
                      <div className="truncate text-[10.5px] text-muted-foreground">
                        {detailForResult(r.entityType, r.data, nameFor)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[10.5px] text-muted-foreground">
                      {formatEventTime(r.occurredAt)}
                    </div>
                    {open ? (
                      <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {open && (
                    <pre className="overflow-x-auto border-t border-border bg-background/40 px-4 py-3 text-[10.5px] leading-relaxed text-secondary">
                      {JSON.stringify(r.data, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
