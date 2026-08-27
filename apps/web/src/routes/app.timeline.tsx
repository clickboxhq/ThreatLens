import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { HydrationBoundary } from "@/components/soc/ui/hydration-boundary";
import { EntityTypeIcon } from "@/components/soc/ui/entity-icon";
import { useTimeline } from "@/hooks/use-timeline";
import { useAccount } from "@/hooks/use-account";
import type { EntityType } from "@/types/telemetry";
import { ListTree, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/timeline")({
  component: TimelinePage,
  head: () => ({
    meta: [
      { title: "Global Timeline — ThreatLens" },
      {
        name: "description",
        content:
          "Every event you curated as relevant, in order, grouped into per-identity, per-device and per-mailbox swimlanes.",
      },
      { property: "og:title", content: "Global Timeline — ThreatLens" },
      {
        property: "og:description",
        content: "Reconstruct the attack chain across identity, endpoint, email and cloud.",
      },
    ],
  }),
});

const lanes: { key: EntityType; label: string }[] = [
  { key: "identity", label: "Identities" },
  { key: "device", label: "Devices" },
  { key: "mailbox", label: "Mailboxes" },
  { key: "cloud", label: "Cloud" },
];

function TimelinePage() {
  return (
    <HydrationBoundary>
      <TimelinePageInner />
    </HydrationBoundary>
  );
}

function TimelinePageInner() {
  const { globalTimeline, events, casesWithTimelineCount } = useTimeline();
  const { resetSession } = useAccount();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Global Timeline"
        description="Everything you pulled in as relevant, chronologically ordered and grouped by entity lane."
        actions={
          globalTimeline.length > 0 ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary">
              {globalTimeline.length} curated events
            </span>
          ) : undefined
        }
      />

      {events.length === 0 ? (
        <Panel>
          <div className="py-12 text-center">
            <ListTree className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-[13px] font-medium">Nothing on the timeline yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] text-secondary">
              Open a case and use <span className="text-[color:var(--info)]">Timeline</span> on any
              event to build the attack narrative here. What you curate is itself scored.
            </p>
            <Link
              to="/app/incidents"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Go to Incident Queue
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          <Panel title="Chronological" padded={false} className="mb-4">
            <ol className="relative ml-7 border-l border-border py-3 pr-4">
              {events.map((e) => (
                <li key={e.id} className="relative py-2.5 pl-5">
                  <span className="absolute -left-[5px] top-4 size-2 rounded-full bg-[color:var(--info)]" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {e.ts.slice(0, 10)} {e.ts.slice(11, 16)} UTC
                    </span>
                    <span className="text-[12.5px] font-medium">{e.action}</span>
                    <SeverityBadge level={e.severity} />
                    {e.correlationId && (
                      <span className="rounded border border-[color:var(--info)]/40 px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--info)]">
                        {e.correlationId}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-secondary">{e.detail}</p>
                  <div className="mt-1 flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
                    <EntityTypeIcon type={e.entityType} />
                    {e.entityType} · {e.entity}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {lanes.map((lane) => {
              const laneEvents = events.filter((e) => e.entityType === lane.key);
              return (
                <Panel key={lane.key} title={lane.label} padded={false}>
                  {laneEvents.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
                      No events in this lane
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {laneEvents.map((e) => (
                        <li key={e.id} className="px-4 py-2.5">
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            {e.ts.slice(11, 16)} UTC
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium">{e.action}</div>
                          <div className="mt-0.5 truncate font-mono text-[10.5px] text-secondary">
                            {e.entity}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
            <span>Curated across {casesWithTimelineCount} case(s)</span>
            <button
              onClick={resetSession}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 hover:text-foreground"
            >
              <Trash2 className="size-3" /> Reset session data
            </button>
          </div>
        </>
      )}
    </div>
  );
}
