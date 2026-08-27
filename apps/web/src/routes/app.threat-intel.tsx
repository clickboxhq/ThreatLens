import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useThreatIntel } from "@/hooks/use-threat-intel";
import { Globe, Hash, Link as LinkIcon, Network, Radar } from "lucide-react";

const iocIcon: Record<string, typeof Globe> = {
  domain: Globe,
  ip: Network,
  sha256: Hash,
  url: LinkIcon,
};

export const Route = createFileRoute("/app/threat-intel")({
  component: TIPage,
  head: () => ({ meta: [{ title: "ThreatLens · Threat Intelligence" }] }),
});

function TIPage() {
  const { actors, iocs } = useThreatIntel();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Threat Intelligence"
        description="Curated adversary profiles, IOCs, and campaign correlation across your environment."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Tracked adversaries" padded={false}>
          <ul className="divide-y divide-border">
            {actors.map((a) => (
              <li key={a.name} className="flex items-center gap-3 px-4 py-3">
                <IconTile tone="info" size="md">
                  <Radar className="size-4" />
                </IconTile>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.region} · {a.motive}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] tabular-nums">{a.campaigns} campaigns</div>
                  <div className="mt-1">
                    <SeverityBadge level={a.sev} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent IOCs" padded={false}>
          <ul className="divide-y divide-border">
            {iocs.map((i) => {
              const Icon = iocIcon[i.type] ?? Hash;
              return (
                <li
                  key={i.v}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3"
                >
                  <IconTile size="md">
                    <Icon className="size-3.5" />
                  </IconTile>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px]">{i.v}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {i.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <SeverityBadge level={i.sev} />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
