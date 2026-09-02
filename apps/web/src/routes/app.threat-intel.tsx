import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { SessionPicker } from "@/components/soc/session-picker";
import { useActiveSession } from "@/hooks/use-active-session";
import { useThreatIntel } from "@/hooks/use-threat-intel";
import { investigationsService } from "@/services/investigations";
import { REPUTATION_SEVERITY, type IndicatorType } from "@/types/threat-intel-page";
import { Globe, Hash, Link as LinkIcon, Loader2, Network, Radar, Search } from "lucide-react";

const iocIcon: Record<IndicatorType, typeof Globe> = {
  domain: Globe,
  ip: Network,
  hash: Hash,
  url: LinkIcon,
};

type ThreatIntelSearch = {
  type?: IndicatorType;
  value?: string;
};

export const Route = createFileRoute("/app/threat-intel")({
  component: TIPage,
  validateSearch: (search: Record<string, unknown>): ThreatIntelSearch => ({
    type:
      search.type === "ip" ||
      search.type === "domain" ||
      search.type === "hash" ||
      search.type === "url"
        ? search.type
        : undefined,
    value: typeof search.value === "string" ? search.value : undefined,
  }),
  head: () => ({ meta: [{ title: "ThreatLens · Threat Intelligence" }] }),
});

type LookupResult = {
  value: string;
  type: string;
  reputation: "malicious" | "suspicious" | "unknown" | "known_good";
  actorAttribution: string | null;
  context: string | null;
};

const REPUTATION_COPY: Record<LookupResult["reputation"], string> = {
  malicious: "Known malicious",
  suspicious: "Suspicious",
  unknown: "No match in this investigation's threat data",
  known_good: "Known good",
};

/**
 * The real lookup surface Threat Intelligence was missing — previously this page only ever
 * showed a replay of past lookups made from inside a case workspace; there was no way to
 * actually investigate an IP/domain/hash/URL from here. Backed by the same session-scoped
 * lookup endpoint the case workspace uses (never a browsable full indicator list — that
 * would hand back the scenario's answer key), scoped to whichever investigation you pick.
 */
function TIPage() {
  const { type: prefillType, value: prefillValue } = Route.useSearch();
  const {
    isLoading: sessionsLoading,
    activeSessions,
    selectedSessionId,
    setSelectedSessionId,
  } = useActiveSession();
  const { actors, iocs, state } = useThreatIntel();

  const [type, setType] = useState<IndicatorType>(prefillType ?? "ip");
  const [value, setValue] = useState(prefillValue ?? "");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const runLookup = async (overrideValue?: string, overrideType?: IndicatorType) => {
    const v = overrideValue ?? value;
    const t = overrideType ?? type;
    if (!selectedSessionId || !v.trim()) return;
    setLooking(true);
    setLookupError(null);
    setResult(null);
    try {
      const r = await investigationsService.lookupThreatIntel(selectedSessionId, t, v.trim());
      setResult(r);
    } catch {
      setLookupError("That lookup failed — check the value and try again.");
    } finally {
      setLooking(false);
    }
  };

  // A pivot from elsewhere in the app (device network tab, etc.) lands here with a
  // pre-filled indicator via query params — run it automatically once a session and the
  // prefill are both available, instead of leaving the analyst to press "Look up" again.
  useEffect(() => {
    if (prefillValue && selectedSessionId) {
      runLookup(prefillValue, prefillType ?? "ip");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillValue, prefillType, selectedSessionId]);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Threat Intelligence"
        description="Look up an indicator against this investigation's data, then review everything you've found across every investigation."
        actions={
          activeSessions.length > 0 ? (
            <SessionPicker
              sessions={activeSessions}
              selectedId={selectedSessionId}
              onChange={setSelectedSessionId}
            />
          ) : undefined
        }
      />

      <Panel title="Indicator lookup" className="mb-4">
        {sessionsLoading ? (
          <p className="text-[12px] text-secondary">Loading your investigations…</p>
        ) : !selectedSessionId ? (
          <p className="text-[12px] text-secondary">
            Start or resume an investigation to look up an indicator against its threat data.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IndicatorType)}
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
              <button
                onClick={() => runLookup()}
                disabled={looking || !value.trim()}
                className="btn-app-primary"
              >
                {looking ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Search className="size-3.5" />
                )}
                Look up
              </button>
            </div>

            {lookupError && (
              <p className="mt-3 text-[12px] text-[color:var(--critical)]">{lookupError}</p>
            )}

            {result && (
              <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[12.5px]">{result.value}</span>
                  <SeverityBadge level={REPUTATION_SEVERITY[result.reputation]} />
                </div>
                <p className="mt-1.5 text-[12px] text-secondary">
                  {REPUTATION_COPY[result.reputation]}
                  {result.actorAttribution && ` · attributed to ${result.actorAttribution}`}
                </p>
                {result.context && (
                  <p className="mt-1 text-[11.5px] text-muted-foreground">{result.context}</p>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      {state === "empty" ? (
        <Panel>
          <div className="py-8 text-center">
            <Search className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-[13px] font-medium">No lookups yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-secondary">
              Real matches from the lookup above — or from a case workspace's own Threat
              Intelligence panel — will show up here.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Attributed actors" padded={false}>
            {actors.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
                None of your matched indicators carried an actor attribution.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {actors.map((a) => (
                  <li key={a.name} className="flex items-center gap-3 px-4 py-3">
                    <IconTile tone="info" size="md">
                      <Radar className="size-4" />
                    </IconTile>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.indicatorCount} indicator{a.indicatorCount === 1 ? "" : "s"} you've found
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] tabular-nums">
                        {a.campaigns} scenario{a.campaigns === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1">
                        <SeverityBadge level={REPUTATION_SEVERITY[a.reputation]} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Indicators you've found" padded={false}>
            <ul className="divide-y divide-border">
              {iocs.map((i) => {
                const Icon = iocIcon[i.type] ?? Hash;
                return (
                  <li
                    key={i.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                  >
                    <IconTile size="md">
                      <Icon className="size-3.5" />
                    </IconTile>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12px]">{i.value}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {i.scenarioTitle}
                        </span>
                        {i.actorAttribution && (
                          <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {i.actorAttribution}
                          </span>
                        )}
                      </div>
                      {i.context && (
                        <p className="mt-1 truncate text-[10.5px] text-secondary">{i.context}</p>
                      )}
                    </div>
                    <SeverityBadge level={REPUTATION_SEVERITY[i.reputation]} />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
