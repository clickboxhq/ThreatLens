import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Kbd } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useSearch } from "@/hooks/use-search";
import { Search } from "lucide-react";

export const Route = createFileRoute("/app/search")({
  component: SearchPage,
  head: () => ({ meta: [{ title: "ThreatLens · Global Search" }] }),
});

function SearchPage() {
  const { categories, topResults } = useSearch();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Global Search"
        description="Search across identities, endpoints, alerts, incidents, files, domains, IPs, MITRE techniques, and scenarios."
      />

      <Panel>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-[13px]">
          <Search className="size-4 text-muted-foreground" />
          <input
            defaultValue="storm-1811"
            className="flex-1 bg-transparent focus:outline-none"
            placeholder="Search everything…"
          />
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[12px] text-secondary hover:text-foreground"
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
        <Panel title="Top results">
          <ul className="divide-y divide-border">
            {topResults.map((r) => (
              <li key={r.title} className="flex items-center gap-3 py-3">
                <IconTile size="md">
                  <r.icon className="size-3.5" />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{r.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r.meta}</div>
                </div>
                <button className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground">
                  Open
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
