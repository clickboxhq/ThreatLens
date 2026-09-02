import { useState } from "react";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { ApiError } from "@/lib/api-client";
import { REPUTATION_SEVERITY } from "@/types/threat-intel-page";
import { Loader2, NotebookPen, Radar } from "lucide-react";
import type { investigationsService } from "@/services/investigations";

type LookupResult = Awaited<ReturnType<typeof investigationsService.lookupThreatIntel>>;

/**
 * Threat Intelligence as its own investigation activity, not a sidebar widget — same real
 * lookupThreatIntel mutation the old right-rail panel used, given room to actually work in.
 * "Add to investigation" doesn't invent a new backend concept for attaching a finding to the
 * incident (no such endpoint exists) — it reuses the same addNote mutation every note on this
 * page already goes through, pre-filled with the lookup result.
 */
export function StageIntelligence({
  lookupThreatIntel,
  lookingUp,
  locked,
  onAddFindingNote,
}: {
  lookupThreatIntel: (input: {
    type: "hash" | "ip" | "domain" | "url";
    value: string;
  }) => Promise<LookupResult>;
  lookingUp: boolean;
  locked: boolean;
  onAddFindingNote: (body: string) => void;
}) {
  const [type, setType] = useState<"hash" | "ip" | "domain" | "url">("ip");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noted, setNoted] = useState(false);

  const runLookup = async () => {
    if (!value.trim()) return;
    setError(null);
    setResult(null);
    setNoted(false);
    try {
      const r = await lookupThreatIntel({ type, value: value.trim() });
      setResult(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That lookup failed — check the value and try again.");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        title="Threat Intelligence"
        description="Check whether an IP, domain, hash, or URL you found is a known indicator in this investigation."
      />
      <Panel title="Indicator lookup">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="h-9 rounded-md border border-border bg-background px-2.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ip">IP</option>
            <option value="domain">Domain</option>
            <option value="hash">Hash</option>
            <option value="url">URL</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runLookup()}
            placeholder="e.g. 185.220.101.44"
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[12.5px] font-mono outline-none placeholder:font-sans focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button onClick={runLookup} disabled={lookingUp || !value.trim()} className="btn-app-primary">
            {lookingUp ? <Loader2 className="size-3.5 animate-spin" /> : <Radar className="size-3.5" />}
            Look up
          </button>
        </div>

        {error && <p className="mt-3 text-[12px] text-[color:var(--critical)]">{error}</p>}

        {result && (
          <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-[12.5px]">{result.value}</span>
              <SeverityBadge level={REPUTATION_SEVERITY[result.reputation]} />
            </div>
            <p className="mt-1.5 text-[12px] text-secondary">
              {result.reputation === "malicious"
                ? "Known malicious"
                : result.reputation === "suspicious"
                  ? "Suspicious"
                  : result.reputation === "known_good"
                    ? "Known good"
                    : "No match in this investigation's threat data"}
              {result.actorAttribution && ` · attributed to ${result.actorAttribution}`}
            </p>
            {result.context && <p className="mt-1 text-[11.5px] text-muted-foreground">{result.context}</p>}

            {!locked && (
              <button
                disabled={noted}
                onClick={() => {
                  onAddFindingNote(
                    `Threat intel: ${result.value} (${type}) — ${result.reputation}${
                      result.actorAttribution ? `, attributed to ${result.actorAttribution}` : ""
                    }.${result.context ? ` ${result.context}` : ""}`,
                  );
                  setNoted(true);
                }}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11.5px] text-secondary hover:text-foreground disabled:opacity-50"
              >
                <NotebookPen className="size-3.5" />
                {noted ? "Added to analyst notes" : "Add finding to investigation"}
              </button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
