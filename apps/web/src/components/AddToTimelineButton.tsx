import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { timelineApi } from '../api/endpoints';

interface AddToTimelineButtonProps {
  eventKey: string;
  eventTable: string;
  eventId: string;
  incidentId: string | null;
  addedKeys: Set<string>;
  onAdded: (key: string) => void;
}

// §2.9: "Drag-free, click-to-add model: any evidence item, anywhere in the product, has an
// 'Add to Timeline' action" — deliberately a single click with no justification field, unlike
// PinEvidenceButton (§2.10, which requires one) since Timeline is about *order*, not *proof*.
export function AddToTimelineButton({ eventKey, eventTable, eventId, incidentId, addedKeys, onAdded }: AddToTimelineButtonProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [adding, setAdding] = useState(false);

  if (addedKeys.has(eventKey)) return <span style={{ fontSize: 12, color: '#64748b' }}>On timeline</span>;

  return (
    <button
      disabled={!incidentId || adding}
      onClick={async () => {
        setAdding(true);
        try {
          await timelineApi.add(sessionId!, incidentId!, eventTable, eventId);
          onAdded(eventKey);
        } finally {
          setAdding(false);
        }
      }}
    >
      {adding ? 'Adding...' : 'Add to Timeline'}
    </button>
  );
}
