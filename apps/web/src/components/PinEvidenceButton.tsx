import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { incidentsApi } from '../api/endpoints';

interface PinEvidenceButtonProps {
  eventKey: string;
  eventTable: string;
  eventId: string;
  incidentId: string | null;
  pinnedKeys: Set<string>;
  onPinned: (key: string) => void;
}

export function PinEvidenceButton({ eventKey, eventTable, eventId, incidentId, pinnedKeys, onPinned }: PinEvidenceButtonProps) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [pinning, setPinning] = useState(false);
  const [justification, setJustification] = useState('');

  if (pinnedKeys.has(eventKey)) return <span style={{ fontSize: 12, color: '#64748b' }}>Pinned</span>;

  if (!pinning) {
    return (
      <button disabled={!incidentId} onClick={() => setPinning(true)}>
        Pin as Evidence
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        aria-label="Evidence justification"
        placeholder="Why is this relevant? (5+ characters)"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        style={{ minWidth: 200 }}
        autoFocus
      />
      <button
        disabled={justification.trim().length < 5}
        onClick={async () => {
          await incidentsApi.pinEvidence(sessionId!, incidentId!, eventTable, eventId, justification.trim());
          onPinned(eventKey);
        }}
      >
        Confirm
      </button>
      <button onClick={() => setPinning(false)}>Cancel</button>
    </div>
  );
}
