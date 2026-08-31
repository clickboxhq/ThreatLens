import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useSearch } from "@/hooks/use-search";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import type { GlobalSearchResult } from "@/types/search";

export const Route = createFileRoute("/app/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "ThreatLens · Global Search" }] }),
});

function SearchPage() {
  const { query, setQuery, categories, activeCategory, setActiveCategory, results, isPending } =
    useSearch();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Global Search"
        description="Search sign-ins, emails, cloud actions, and endpoint telemetry across every investigation you've run."
      />

      <Panel>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-[13px]">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent focus:outline-none"
            placeholder="Search across your investigations…"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.entityType}
              onClick={() =>
                setActiveCategory(activeCategory === c.entityType ? null : c.entityType)
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                activeCategory === c.entityType
                  ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-foreground"
                  : "border-border bg-background text-secondary hover:text-foreground"
              }`}
            >
              <c.icon className="size-3.5" /> {c.label}
              <span className="rounded bg-card px-1 text-[10px] text-muted-foreground">
                {c.count}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="mt-6 space-y-4">
        {isPending ? (
          <Panel>
            <p className="py-6 text-center text-[12px] text-muted-foreground">Searching…</p>
          </Panel>
        ) : results.length === 0 ? (
          <Panel>
            <p className="py-6 text-center text-[12px] text-muted-foreground">
              No matches. Try a different term, or clear the category filter.
            </p>
          </Panel>
        ) : (
          <ResultsByInvestigation results={results} query={query} />
        )}
      </div>
    </div>
  );
}

/**
 * Groups flat results by the investigation they came from — "Related Investigations, N
 * results" per investigation, rather than one long undifferentiated list. A search result on
 * its own ("Sign-in from 45.86.x.x") means little without knowing which case it's part of.
 */
function ResultsByInvestigation({
  results,
  query,
}: {
  results: GlobalSearchResult[];
  query: string;
}) {
  const groups = useMemo(() => {
    const bySession = new Map<string, { scenarioTitle: string; items: GlobalSearchResult[] }>();
    for (const r of results) {
      const g = bySession.get(r.sessionId);
      if (g) g.items.push(r);
      else bySession.set(r.sessionId, { scenarioTitle: r.scenarioTitle, items: [r] });
    }
    return [...bySession.entries()].sort((a, b) => b[1].items.length - a[1].items.length);
  }, [results]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (sessionId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });

  return (
    <>
      {query && (
        <p className="text-[11px] text-muted-foreground">
          {results.length} result{results.length === 1 ? "" : "s"} across {groups.length}{" "}
          investigation{groups.length === 1 ? "" : "s"}
        </p>
      )}
      {groups.map(([sessionId, group]) => {
        const isCollapsed = collapsed.has(sessionId);
        return (
          <Panel key={sessionId} padded={false}>
            <button
              onClick={() => toggle(sessionId)}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2.5 text-left hover:bg-background/40"
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground" />
              )}
              <span className="flex-1 text-[12.5px] font-medium">{group.scenarioTitle}</span>
              <span className="rounded bg-card px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                {group.items.length} result{group.items.length === 1 ? "" : "s"}
              </span>
              <Link
                to="/app/cases/$id"
                params={{ id: sessionId }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
              >
                Open
              </Link>
            </button>
            {!isCollapsed && (
              <ul className="divide-y divide-border">
                {group.items.slice(0, 20).map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <IconTile size="sm">
                      <Search className="size-3" />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium">{r.title}</div>
                      <div className="truncate text-[10.5px] text-muted-foreground">{r.meta}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </>
  );
}
