import { useParams } from 'react-router-dom';
import { timelineApi } from '../api/endpoints';
import type { TimelineItem } from '../api/types';

const ENTITY_ICON: Record<TimelineItem['entityType'], string> = {
  identity: '\u{1F464}', // person
  device: '\u{1F4BB}', // laptop
  mailbox: '\u{2709}️', // envelope
};

const CORRELATION_PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

function correlationColorMap(items: TimelineItem[]): Map<string, string> {
  const colorByGroupKey = new Map<string, string>();
  let next = 0;
  for (const item of items) {
    if (item.relatedItemIds.length === 0) continue;
    const groupKey = [item.id, ...item.relatedItemIds].sort().join(',');
    if (!colorByGroupKey.has(groupKey)) {
      colorByGroupKey.set(groupKey, CORRELATION_PALETTE[next % CORRELATION_PALETTE.length]);
      next += 1;
    }
  }
  return colorByGroupKey;
}

// §2.9 Global Timeline: swimlanes are rendered as one horizontal lane per entity (identity,
// device, or mailbox), with that lane's items placed left-to-right in chronological order —
// a sequential rather than pixel-proportional-to-time layout, consistent with this app's plain,
// table/list-based UI throughout (no charting library used anywhere else either). Correlated
// items (§6.9's shared correlation_id, surfaced only as item-to-item relations, never the raw
// id — §12.3) share a colored border instead of a literal connecting line.
export function GlobalTimeline({
  items,
  incidentId,
  onRemoved,
  readOnly = false,
}: {
  items: TimelineItem[];
  incidentId: string;
  onRemoved?: (eventTable: string, eventId: string) => void;
  // §2.14: the report view embeds this same component against a closed (server-enforced
  // immutable, §2.3) incident's timeline — no remove action makes sense there.
  readOnly?: boolean;
}) {
  const { sessionId } = useParams<{ sessionId: string }>();

  if (items.length === 0) {
    return readOnly ? (
      <p style={{ color: '#64748b', fontSize: 14 }}>No timeline items.</p>
    ) : (
      <p style={{ color: '#64748b', fontSize: 14 }}>No timeline items yet. Use "Add to Timeline" on any evidence, anywhere in the product.</p>
    );
  }

  const colorByGroupKey = correlationColorMap(items);
  function colorFor(item: TimelineItem): string | null {
    if (item.relatedItemIds.length === 0) return null;
    const groupKey = [item.id, ...item.relatedItemIds].sort().join(',');
    return colorByGroupKey.get(groupKey) ?? null;
  }

  const lanes = new Map<string, { entityType: TimelineItem['entityType']; label: string; items: TimelineItem[] }>();
  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    const lane = lanes.get(key) ?? { entityType: item.entityType, label: item.entityLabel, items: [] };
    lane.items.push(item);
    lanes.set(key, lane);
  }
  for (const lane of lanes.values()) {
    lane.items.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }

  async function remove(item: TimelineItem) {
    await timelineApi.remove(sessionId!, incidentId, item.eventTable, item.id);
    onRemoved?.(item.eventTable, item.id);
  }

  return (
    <div>
      {[...lanes.values()].map((lane) => (
        <div
          key={`${lane.entityType}:${lane.label}`}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderBottom: '1px solid #f1f5f9', padding: '8px 0' }}
        >
          <div style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#334155' }}>
            {ENTITY_ICON[lane.entityType]} {lane.label}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {lane.items.map((item) => {
              const color = colorFor(item);
              return (
                <div
                  key={item.id}
                  style={{
                    border: `2px solid ${color ?? '#e2e8f0'}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 12,
                    maxWidth: 220,
                  }}
                  title={color ? 'Correlated with another item on this timeline (matching border color)' : undefined}
                >
                  <div style={{ color: '#94a3b8' }}>{new Date(item.occurredAt).toLocaleTimeString()}</div>
                  <div>{item.summary}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ color: '#94a3b8' }}>{item.source.join(' + ')}</span>
                    {!readOnly && item.source.includes('manual') && (
                      <button
                        onClick={() => remove(item)}
                        style={{ fontSize: 11, padding: '1px 4px', marginLeft: 6 }}
                        title="Remove from timeline"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
