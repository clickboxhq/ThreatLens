import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { incidentsApi, searchApi } from '../api/endpoints';
import type { IncidentSummary, SearchResult } from '../api/types';
import { SessionNav } from '../components/Layout';
import { PinEvidenceButton } from '../components/PinEvidenceButton';
import { AddToTimelineButton } from '../components/AddToTimelineButton';

const SIGN_IN_FIELDS = [
  { field: 'sourceIp', label: 'Source IP' },
  { field: 'sourceCountry', label: 'Source Country' },
  { field: 'sourceCity', label: 'Source City' },
  { field: 'application', label: 'Application' },
];

const EMAIL_FIELDS = [
  { field: 'senderAddress', label: 'Sender Address' },
  { field: 'subject', label: 'Subject' },
  { field: 'recipientAddress', label: 'Recipient Address' },
];

function resultKey(result: SearchResult): string {
  const eventTable = result.entityType === 'sign_in_event' ? 'sign_in_events' : 'email_messages';
  return `${eventTable}:${result.data.id}`;
}

function ResultRow({
  result,
  targetIncidentId,
  pinnedKeys,
  onPinned,
  timelineKeys,
  onAddedToTimeline,
}: {
  result: SearchResult;
  targetIncidentId: string | null;
  pinnedKeys: Set<string>;
  onPinned: (key: string) => void;
  timelineKeys: Set<string>;
  onAddedToTimeline: (key: string) => void;
}) {
  const eventTable = result.entityType === 'sign_in_event' ? 'sign_in_events' : 'email_messages';
  const summary =
    result.entityType === 'sign_in_event'
      ? `${result.data.sourceCity}, ${result.data.sourceCountry} → ${result.data.application} (${result.data.result})`
      : `"${result.data.subject}" from ${result.data.senderAddress}`;

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td>{new Date(result.occurredAt).toLocaleString()}</td>
      <td>{result.entityType === 'sign_in_event' ? 'Sign-in' : 'Email'}</td>
      <td>{summary}</td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <PinEvidenceButton
            eventKey={resultKey(result)}
            eventTable={eventTable}
            eventId={result.data.id}
            incidentId={targetIncidentId}
            pinnedKeys={pinnedKeys}
            onPinned={onPinned}
          />
          <AddToTimelineButton
            eventKey={resultKey(result)}
            eventTable={eventTable}
            eventId={result.data.id}
            incidentId={targetIncidentId}
            addedKeys={timelineKeys}
            onAdded={onAddedToTimeline}
          />
        </div>
      </td>
    </tr>
  );
}

export function SearchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [freetext, setFreetext] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [targetIncidentId, setTargetIncidentId] = useState<string>('');
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());
  const [timelineKeys, setTimelineKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) return;
    incidentsApi.list(sessionId).then((list) => {
      setIncidents(list);
      const openIncident = list.find((i) => i.status !== 'closed');
      if (openIncident) setTargetIncidentId(openIncident.id);
    });
  }, [sessionId]);

  function markPinned(key: string) {
    setPinnedKeys((prev) => new Set(prev).add(key));
  }

  function markAddedToTimeline(key: string) {
    setTimelineKeys((prev) => new Set(prev).add(key));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const filters = Object.entries(fieldValues)
        .filter(([, value]) => value.trim().length > 0)
        .map(([field, value]) => ({ field, value: value.trim() }));
      const response = await searchApi.search(sessionId!, filters, freetext.trim() || undefined);
      setResults(response.results);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <SessionNav />
      <h1>Search</h1>
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Search sign-in events and emails across this session. Leave everything blank to see everything.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Free text (searches email subject, sender, and body)"
            value={freetext}
            onChange={(e) => setFreetext(e.target.value)}
            style={{ width: '100%', maxWidth: 500 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Sign-in fields</div>
            {SIGN_IN_FIELDS.map(({ field, label }) => (
              <div key={field} style={{ marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder={label}
                  value={fieldValues[field] ?? ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                  style={{ width: 200 }}
                />
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Email fields</div>
            {EMAIL_FIELDS.map(({ field, label }) => (
              <div key={field} style={{ marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder={label}
                  value={fieldValues[field] ?? ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                  style={{ width: 200 }}
                />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {incidents.length > 0 && (
        <label style={{ display: 'block', fontSize: 13, margin: '16px 0' }}>
          Pin evidence to incident:{' '}
          <select value={targetIncidentId} onChange={(e) => setTargetIncidentId(e.target.value)}>
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} ({i.status})
              </option>
            ))}
          </select>
        </label>
      )}

      {results !== null && (
        <>
          <h3>{results.length} result{results.length === 1 ? '' : 's'}</h3>
          {results.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Summary</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <ResultRow
                    key={resultKey(result)}
                    result={result}
                    targetIncidentId={targetIncidentId || null}
                    pinnedKeys={pinnedKeys}
                    onPinned={markPinned}
                    timelineKeys={timelineKeys}
                    onAddedToTimeline={markAddedToTimeline}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p>No results.</p>
          )}
        </>
      )}
    </div>
  );
}
