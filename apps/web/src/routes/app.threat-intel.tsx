import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useThreatIntel } from "@/hooks/use-threat-intel";
import { REPUTATION_SEVERITY, type IndicatorType } from "@/types/threat-intel-page";
import { Globe, Hash, Link as LinkIcon, Network, Radar, Search } from "lucide-react";

const iocIcon: Record<IndicatorType, typeof Globe> = {
  domain: Globe,
  ip: Network,
  hash: Hash,
  url: LinkIcon,
};

export const Route = createFileRoute("/app/threat-intel")({
  component: TIPage,
  head: () => ({ meta: [{ title: "ThreatLens · Threat Intelligence" }] }),
});

function TIPage() {
  const { actors, iocs, state } = useThreatIntel();

  if (state === "empty") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader
          title="Threat Intelligence"
          description="Every indicator you've looked up during an investigation, and what it turned out to be."
        />
        <Panel>
          <div className="py-12 text-center">
            <Search className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-[13px] font-medium">No lookups yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-secondary">
              Open an active investigation and look up an IP, domain, hash, or URL from the Threat
              Intel panel — real matches show up here.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Threat Intelligence"
        description="Every indicator you've looked up during an investigation, and what it turned out to be."
      />

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
    </div>
  );
}
