import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Mail, MonitorSmartphone, Pin, UserRound } from "lucide-react";
import type {
  EvidenceItemDto,
  TimelineEntityType,
  TimelineItemDto,
} from "@/types/threatlens-investigation";

const ENTITY_ICON: Record<TimelineEntityType, typeof UserRound> = {
  identity: UserRound,
  device: MonitorSmartphone,
  mailbox: Mail,
};

const LANE_HEIGHT = 110;
const LANE_LABEL_X = 24;
const EVENT_X_START = 220;
const EVENT_X_SPAN = 1400;

type EntityNodeData = { label: string; entityType: TimelineEntityType; eventCount: number };
type EventNodeData = { label: string; time: string; pinned: boolean };

function EntityNode({ data }: NodeProps<Node<EntityNodeData>>) {
  const Icon = ENTITY_ICON[data.entityType];
  return (
    <div className="flex w-48 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <Handle type="source" position={Position.Right} className="!bg-border" />
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="truncate text-[12px] font-medium">{data.label}</div>
        <div className="text-[10px] text-muted-foreground">
          {data.eventCount} event{data.eventCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

function EventNode({ data }: NodeProps<Node<EventNodeData>>) {
  return (
    <div
      className={`w-44 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm ${
        data.pinned
          ? "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10"
          : "border-border bg-background"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <Handle type="source" position={Position.Right} className="!bg-border" />
      <div className="flex items-center gap-1">
        {data.pinned && <Pin className="size-2.5 shrink-0 text-[color:var(--warning)]" />}
        <span className="font-mono text-[9.5px] text-muted-foreground">{data.time}</span>
      </div>
      <div className="mt-0.5 line-clamp-2 leading-snug">{data.label}</div>
    </div>
  );
}

const nodeTypes = { entity: EntityNode, event: EventNode };

/**
 * A first real version of the Investigation Graph, per the plan: built entirely from data the
 * Case Workspace already loads (timeline + evidence) — no new backend endpoint. Deliberately a
 * swimlane layout, one lane per entity (identity/device/mailbox), events placed left-to-right by
 * time — this reads more like an actual attack-chain reconstruction than a generic force-directed
 * node graph would, and it's what the timeline panel right next to it is already teaching the
 * Student to build by hand. Cross-lane edges come from TimelineItemDto.relatedItemIds — the same
 * correlation grouping the backend already computes, now drawn instead of only listed.
 *
 * Threat-intel lookups aren't folded in yet — there's no clean way to join a free-text indicator
 * value to a specific timeline event without guessing, and a graph node that pretends to connect
 * to something it doesn't is worse than one that leaves it out. That's the next iteration, not
 * this one.
 */
export function InvestigationGraph({
  timeline,
  evidence,
}: {
  timeline: TimelineItemDto[];
  evidence: EvidenceItemDto[];
}) {
  const pinnedEventIds = useMemo(
    () => new Set(evidence.map((e) => `${e.eventTable}:${e.eventId}`)),
    [evidence],
  );

  const { nodes, edges } = useMemo(() => {
    if (timeline.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };

    const sorted = [...timeline].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    const minTime = new Date(sorted[0].occurredAt).getTime();
    const maxTime = new Date(sorted[sorted.length - 1].occurredAt).getTime();
    const span = maxTime - minTime || 1;
    const xForTime = (t: number) => EVENT_X_START + ((t - minTime) / span) * EVENT_X_SPAN;

    // One lane per distinct entity, in order of first appearance — a stable, readable order
    // rather than alphabetical, so the lane a Student opened first stays near the top.
    const laneIndexByEntity = new Map<string, number>();
    for (const item of sorted) {
      if (!laneIndexByEntity.has(item.entityId)) {
        laneIndexByEntity.set(item.entityId, laneIndexByEntity.size);
      }
    }

    const entityMeta = new Map<
      string,
      { label: string; entityType: TimelineEntityType; count: number }
    >();
    for (const item of sorted) {
      const cur = entityMeta.get(item.entityId);
      if (cur) cur.count += 1;
      else
        entityMeta.set(item.entityId, {
          label: item.entityLabel,
          entityType: item.entityType,
          count: 1,
        });
    }

    const nodes: Node[] = [];
    for (const [entityId, lane] of laneIndexByEntity) {
      const meta = entityMeta.get(entityId)!;
      nodes.push({
        id: `entity:${entityId}`,
        type: "entity",
        position: { x: LANE_LABEL_X, y: lane * LANE_HEIGHT + 20 },
        data: { label: meta.label, entityType: meta.entityType, eventCount: meta.count },
        draggable: true,
      });
    }

    for (const item of sorted) {
      const lane = laneIndexByEntity.get(item.entityId)!;
      const t = new Date(item.occurredAt).getTime();
      nodes.push({
        id: `event:${item.id}`,
        type: "event",
        position: { x: xForTime(t), y: lane * LANE_HEIGHT + 10 },
        data: {
          label: item.summary,
          time: new Date(item.occurredAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }),
          pinned: pinnedEventIds.has(`${item.eventTable}:${item.id}`),
        },
        draggable: true,
      });
    }

    const edges: Edge[] = [];
    for (const item of sorted) {
      edges.push({
        id: `lane:${item.entityId}-${item.id}`,
        source: `entity:${item.entityId}`,
        target: `event:${item.id}`,
        style: { stroke: "var(--border)", strokeWidth: 1 },
      });
    }
    const seenPairs = new Set<string>();
    for (const item of sorted) {
      for (const relatedId of item.relatedItemIds) {
        if (!sorted.some((t) => t.id === relatedId)) continue;
        const pairKey = [item.id, relatedId].sort().join(":");
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        edges.push({
          id: `related:${pairKey}`,
          source: `event:${item.id}`,
          target: `event:${relatedId}`,
          animated: true,
          style: { stroke: "var(--info)", strokeWidth: 1.5 },
        });
      }
    }

    return { nodes, edges };
  }, [timeline, pinnedEventIds]);

  if (timeline.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-[12px] text-muted-foreground">
        Add events to the timeline to see the investigation graph.
      </div>
    );
  }

  return (
    <div className="h-[480px] w-full overflow-hidden rounded-md border border-border">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          colorMode="system"
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-card" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
