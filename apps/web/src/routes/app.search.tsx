import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useSearch } from "@/hooks/use-search";
import { Search } from "lucide-react";

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
        <Panel title={query ? `Results for "${query}"` : "Recent across your investigations"}>
          {isPending ? (
            <p className="py-6 text-center text-[12px] text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted-foreground">
              No matches. Try a different term, or clear the category filter.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.slice(0, 50).map((r, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <IconTile size="md">
                    <Search className="size-3.5" />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{r.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{r.meta}</div>
                  </div>
                  <Link
                    to="/app/cases/$id"
                    params={{ id: r.sessionId }}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
