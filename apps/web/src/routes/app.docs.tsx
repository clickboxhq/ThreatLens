import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { DOC_SECTIONS } from "@/components/soc/docs-content";
import { BookOpen, Search } from "lucide-react";

export const Route = createFileRoute("/app/docs")({
  component: Documentation,
  head: () => ({
    meta: [
      { title: "ThreatLens · Documentation" },
      {
        name: "description",
        content:
          "How to use ThreatLens — running investigations, how scoring works, and what each part of the workspace is for.",
      },
      { property: "og:title", content: "ThreatLens · Documentation" },
      {
        property: "og:description",
        content: "A guide to investigating, scoring, and teaching on ThreatLens.",
      },
    ],
  }),
});

function Documentation() {
  const [active, setActive] = useState(DOC_SECTIONS[0].id);
  const [query, setQuery] = useState("");

  // Filtering the contents list rather than the prose: a search that hid paragraphs would
  // leave people reading half an explanation. This narrows which section to open.
  const q = query.trim().toLowerCase();
  const matches = q
    ? DOC_SECTIONS.filter(
        (s) => s.title.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q),
      )
    : DOC_SECTIONS;

  const section = DOC_SECTIONS.find((s) => s.id === active) ?? DOC_SECTIONS[0];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Documentation"
        description="How to use ThreatLens — investigating, scoring, and everything in the workspace."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3">
          <label className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide"
              aria-label="Search documentation"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-[13px] focus:outline-none focus:border-[color:var(--info)]/50"
            />
          </label>

          <nav aria-label="Documentation sections">
            <ul className="flex flex-col gap-1">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setActive(s.id)}
                    aria-current={s.id === active ? "true" : undefined}
                    className={[
                      "w-full rounded-md border px-3 py-2 text-left transition-colors",
                      s.id === active
                        ? "border-[color:var(--info)]/40 bg-[color:var(--info)]/5"
                        : "border-transparent hover:border-border hover:bg-background/50",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "text-[13px] font-medium",
                        s.id === active ? "text-foreground" : "text-secondary",
                      ].join(" ")}
                    >
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {s.blurb}
                    </div>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="rounded-md border border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                  Nothing matches “{query}”. Try a different word, or email info@useclickbox.com.
                </li>
              )}
            </ul>
          </nav>
        </div>

        <Panel>
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
            <BookOpen className="size-4 text-[color:var(--info)]" />
            <h2 className="text-[15px] font-semibold text-foreground">{section.title}</h2>
          </div>
          {section.body}
        </Panel>
      </div>
    </div>
  );
}
