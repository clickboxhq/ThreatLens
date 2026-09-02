import { useEffect, useState } from "react";
import { Panel, SeverityBadge } from "@/components/soc/primitives";
import { Pin, ListTree, Search, Mail, UserRound, MonitorSmartphone } from "lucide-react";
import { labelForResult, detailForResult } from "@/lib/search-result-format";
import type { SearchEntityType } from "@/types/socverse-investigation";

const ENTITY_TYPE_LABEL: Record<string, string> = {
  sign_in_event: "Sign-ins",
  email_message: "Emails",
  cloud_event: "Cloud",
  process_event: "Processes",
  file_event: "Files",
  network_event: "Network",
  http_request: "Web",
};

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
  if (entityType === "process_event" || entityType === "network_event") return "high";
  if (entityType === "email_message" || entityType === "cloud_event") return "medium";
  return "info";
}

type Pivot = { kind: "email" | "identity" | "device"; id: string; label: string; icon: typeof Mail };

function pivotsFor(entityType: SearchEntityType, data: Record<string, unknown>): Pivot[] {
  const pivots: Pivot[] = [];
  const identityId = typeof data.identityId === "string" ? data.identityId : null;
  const deviceId = typeof data.deviceId === "string" ? data.deviceId : null;
  if (entityType === "email_message") {
    pivots.push({ kind: "email", id: String(data.id), label: "Open message", icon: Mail });
  }
  if (identityId) pivots.push({ kind: "identity", id: identityId, label: "View account", icon: UserRound });
  if (deviceId) pivots.push({ kind: "device", id: deviceId, label: "View device", icon: MonitorSmartphone });
  return pivots;
}

type SearchResult = { entityType: SearchEntityType; occurredAt: string; data: Record<string, unknown> };

/**
 * Investigate: the core analytical workspace, full width now instead of a squeezed 2/3 column.
 * Same real search mutation as before (search.service.ts's structured/freetext query over 7
 * telemetry tables) — this stage only changes how much room it gets, not what it does.
 */
export function StageInvestigate({
  search,
  searching,
  nameFor,
  pinnedIds,
  timelineIds,
  locked,
  onPin,
  onUnpin,
  onAddToTimeline,
  onRemoveFromTimeline,
  onOpenEmail,
  onOpenIdentity,
  onOpenDevice,
}: {
  search: (input: { freetext?: string }) => Promise<SearchResult[]>;
  searching: boolean;
  nameFor: (id: string) => string | undefined;
  pinnedIds: Set<string>;
  timelineIds: Set<string>;
  locked: boolean;
  onPin: (eventTable: string, eventId: string) => void;
  onUnpin: (eventTable: string, eventId: string) => void;
  onAddToTimeline: (eventTable: string, eventId: string) => void;
  onRemoveFromTimeline: (eventTable: string, eventId: string) => void;
  onOpenEmail: (id: string) => void;
  onOpenIdentity: (id: string) => void;
  onOpenDevice: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchEntityType | "all">("all");
  const [results, setResults] = useState<SearchResult[]>([]);

  const typeCounts = Object.entries(
    results.reduce<Record<string, number>>((acc, r) => {
      acc[r.entityType] = (acc[r.entityType] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]) as [SearchEntityType, number][];

  const visibleResults = typeFilter === "all" ? results : results.filter((r) => r.entityType === typeFilter);

  useEffect(() => {
    const handle = setTimeout(() => {
      search(query.trim() ? { freetext: query.trim() } : {})
        .then(setResults)
        .catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `search` is a stable mutateAsync ref
  }, [query]);

  return (
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
      <ul className="max-h-[calc(100vh-320px)] divide-y divide-border overflow-y-auto">
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
                isPinned ? "border-l-2 border-[color:var(--success)] bg-[color:var(--success)]/[0.04]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium">{labelForResult(r.entityType, r.data)}</span>
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
                    {detailForResult(r.entityType, r.data, nameFor)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span>{new Date(r.occurredAt).toUTCString().slice(5, 22)} UTC</span>
                    {pivotsFor(r.entityType, r.data).map((p) => (
                      <button
                        key={p.label}
                        onClick={() =>
                          p.kind === "email"
                            ? onOpenEmail(p.id)
                            : p.kind === "identity"
                              ? onOpenIdentity(p.id)
                              : onOpenDevice(p.id)
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
                    onClick={() => (isPinned ? onUnpin(eventTable, eventId) : onPin(eventTable, eventId))}
                    title={isPinned ? "Remove from evidence" : "Pin as evidence"}
                    className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40 ${
                      isPinned
                        ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/10 text-[color:var(--success)] hover:border-[color:var(--critical)]/50 hover:text-[color:var(--critical)]"
                        : "border-border bg-background text-secondary hover:text-foreground"
                    }`}
                  >
                    <Pin className="size-3" /> {isPinned ? "Pinned" : "Pin"}
                  </button>
                  <button
                    disabled={locked}
                    onClick={() =>
                      onTimeline ? onRemoveFromTimeline(eventTable, eventId) : onAddToTimeline(eventTable, eventId)
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
            {query.trim() ? "No matching telemetry." : "Type to search this session's telemetry."}
          </li>
        )}
      </ul>
    </Panel>
  );
}
