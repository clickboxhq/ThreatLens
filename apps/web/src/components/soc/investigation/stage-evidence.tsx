import { Panel } from "@/components/soc/primitives";
import { EventTypeIcon, eventTypeLabel } from "@/components/soc/ui/event-icon";
import { InvestigationGraph } from "@/components/soc/investigation-graph";
import { Trash2 } from "lucide-react";
import type { EvidenceItemDto, TimelineItemDto } from "@/types/socverse-investigation";

/**
 * Evidence: what you pinned, why it's arranged the way it is, and how it connects — the
 * chronological timeline and relationship graph both explain *why* a piece of evidence
 * matters, so they belong in the same stage as the evidence list itself rather than scattered
 * across separate panels a reader has to piece back together.
 */
export function StageEvidence({
  evidence,
  timeline,
  locked,
  onRemove,
}: {
  evidence: EvidenceItemDto[];
  timeline: TimelineItemDto[];
  locked: boolean;
  onRemove: (evidenceId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Pinned evidence"
        actions={<span className="text-[11px] text-muted-foreground">{evidence.length} pinned</span>}
        padded={false}
      >
        {evidence.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            Nothing pinned yet. Pin the events that prove your conclusion, from the Investigate
            stage — precision is scored, so noise costs you as much as a missed signal.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {evidence.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <EventTypeIcon eventTable={item.eventTable} />
                      <span className="text-[12.5px] font-medium">
                        {item.display?.title ?? "(details not loaded — found via search)"}
                      </span>
                      <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {eventTypeLabel(item.eventTable)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-secondary">
                      {item.display?.summary}
                    </p>
                  </div>
                  <button
                    disabled={locked}
                    onClick={() => onRemove(item.id)}
                    className="grid size-7 shrink-0 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Chronology">
        {timeline.length === 0 ? (
          <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">
            Add events to reconstruct the attack chain in order, from the Investigate stage.
          </div>
        ) : (
          <ol className="relative ml-6 border-l border-border py-3 pr-4">
            {timeline.map((t) => (
              <li key={t.id} className="relative py-2 pl-5">
                <span className="absolute -left-[5px] top-4 size-2 rounded-full bg-[color:var(--info)]" />
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <EventTypeIcon eventTable={t.eventTable} />
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {new Date(t.occurredAt).toISOString().slice(11, 16)} UTC
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">{eventTypeLabel(t.eventTable)}</span>
                  <span className="font-medium">{t.entityLabel}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-secondary">{t.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Investigation graph">
        <InvestigationGraph timeline={timeline} evidence={evidence} />
      </Panel>
    </div>
  );
}
