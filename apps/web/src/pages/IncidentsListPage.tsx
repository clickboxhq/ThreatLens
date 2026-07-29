import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { incidentsApi, sessionApi } from '../api/endpoints';
import type { IncidentSummary } from '../api/types';
import { SessionNav } from '../components/Layout';

export function IncidentsListPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    incidentsApi.list(sessionId).then(setIncidents);
  }, [sessionId]);

  const closedIncidents = incidents.filter((i) => i.status === 'closed');

  async function submitSession() {
    if (closedIncidents.length === 0) {
      setValidationError('Close at least one incident with a verdict before submitting.');
      return;
    }
    setValidationError(null);
    setSubmitting(true);
    try {
      await sessionApi.submit(
        sessionId!,
        closedIncidents.map((i) => i.id),
      );
      navigate(`/sessions/${sessionId}/results`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SessionNav />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Incidents</h1>
        <button disabled={submitting} onClick={submitSession}>
          {submitting ? 'Submitting...' : 'Submit Session for Scoring'}
        </button>
      </div>
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Build incidents from the Alert Dashboard by selecting related alerts. Close an incident with a verdict once you're
        confident in your findings, then submit the session.
      </p>
      {validationError && <div style={{ color: '#dc2626', marginBottom: 10 }}>{validationError}</div>}
      {incidents.map((incident) => (
        <div key={incident.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <Link to={`/sessions/${sessionId}/incidents/${incident.id}`}>
            <strong>{incident.title}</strong>
          </Link>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Status: {incident.status} {incident.verdict && `· Verdict: ${incident.verdict}`}
          </div>
        </div>
      ))}
      {incidents.length === 0 && <p>No incidents yet.</p>}
    </div>
  );
}
