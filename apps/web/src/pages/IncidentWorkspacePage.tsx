import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { alertsApi, incidentsApi, mitreApi } from '../api/endpoints';
import type { Alert, AnalystNote, EvidenceItem, Incident, MitreTechniqueRef } from '../api/types';
import { ApiError } from '../api/client';
import { SessionNav } from '../components/Layout';

interface EvidenceCandidate {
  alertId: string;
  eventTable: string;
  eventId: string;
  summary: string;
}

export function IncidentWorkspacePage() {
  const { sessionId, incidentId } = useParams<{ sessionId: string; incidentId: string }>();
  const navigate = useNavigate();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [linkedAlerts, setLinkedAlerts] = useState<Alert[]>([]);
  const [candidates, setCandidates] = useState<EvidenceCandidate[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [notes, setNotes] = useState<AnalystNote[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [verdict, setVerdict] = useState('true_positive');
  const [summary, setSummary] = useState('');
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pinningEventId, setPinningEventId] = useState<string | null>(null);
  const [justificationDraft, setJustificationDraft] = useState('');
  const [allTechniques, setAllTechniques] = useState<MitreTechniqueRef[]>([]);

  async function load() {
    if (!sessionId || !incidentId) return;
    const [inc, allAlerts, ev, allNotes, techniques] = await Promise.all([
      incidentsApi.get(sessionId, incidentId),
      alertsApi.list(sessionId),
      incidentsApi.listEvidence(sessionId, incidentId),
      incidentsApi.listNotes(sessionId, incidentId),
      mitreApi.list(),
    ]);
    setIncident(inc);
    setEvidence(ev);
    setNotes(allNotes);
    setAllTechniques(techniques);

    const linked = allAlerts.filter((a) => inc.linkedAlertIds.includes(a.id));
    setLinkedAlerts(linked);

    const evidenceResults = await Promise.all(linked.map((a) => alertsApi.getEvidence(sessionId, a.id)));
    setCandidates(
      evidenceResults.flatMap((r, i) =>
        r.evidence.map((e) => ({ alertId: linked[i].id, eventTable: e.eventTable, eventId: e.eventId, summary: e.summary })),
      ),
    );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, incidentId]);

  // The full catalog (§6.8), not just what linked alerts happen to auto-tag — an alert's
  // own technique is a mechanical hint, not necessarily the answer (§12.3). Techniques a
  // linked alert already suggests are still surfaced first for convenience.
  const suggestedTechniqueIds = new Set(linkedAlerts.filter((a) => a.mitreTechnique).map((a) => a.mitreTechnique!.id));
  const availableTechniques: MitreTechniqueRef[] = [...allTechniques].sort((a, b) => {
    const aSuggested = suggestedTechniqueIds.has(a.id) ? 0 : 1;
    const bSuggested = suggestedTechniqueIds.has(b.id) ? 0 : 1;
    return aSuggested - bSuggested || a.techniqueId.localeCompare(b.techniqueId);
  });

  async function confirmPinEvidence(candidate: EvidenceCandidate) {
    if (justificationDraft.trim().length < 5) return;
    const pinned = await incidentsApi.pinEvidence(
      sessionId!,
      incidentId!,
      candidate.eventTable,
      candidate.eventId,
      justificationDraft.trim(),
    );
    setEvidence((prev) => [...prev, pinned]);
    setPinningEventId(null);
    setJustificationDraft('');
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    const note = await incidentsApi.addNote(sessionId!, incidentId!, noteBody.trim());
    setNotes((prev) => [...prev, note]);
    setNoteBody('');
  }

  function toggleTechnique(id: string) {
    setSelectedTechniqueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function closeIncident(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await incidentsApi.close(sessionId!, incidentId!, verdict, summary, [...selectedTechniqueIds]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close incident.');
    }
  }

  if (!incident) return <p>Loading incident...</p>;

  const pinnedEventIds = new Set(evidence.map((e) => e.eventId));

  return (
    <div>
      <SessionNav />
      <button onClick={() => navigate(`/sessions/${sessionId}/incidents`)}>&larr; Back to incidents</button>
      <h1>{incident.title}</h1>
      <p>
        Status: {incident.status} {incident.verdict && `· Verdict: ${incident.verdict}`}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Linked Alerts &amp; Evidence</h3>
          {candidates.map((c, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 6 }}>
              <div>{c.summary}</div>
              {pinnedEventIds.has(c.eventId) ? (
                <button disabled>Pinned</button>
              ) : pinningEventId === c.eventId ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <input
                    aria-label="Evidence justification"
                    placeholder="Why is this relevant? (5+ characters)"
                    value={justificationDraft}
                    onChange={(e) => setJustificationDraft(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                    autoFocus
                  />
                  <button disabled={justificationDraft.trim().length < 5} onClick={() => confirmPinEvidence(c)}>
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setPinningEventId(null);
                      setJustificationDraft('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setPinningEventId(c.eventId);
                    setJustificationDraft('');
                  }}
                >
                  Pin as Evidence
                </button>
              )}
            </div>
          ))}

          <h3>Evidence Collection ({evidence.length})</h3>
          <ul>
            {evidence.map((e) => (
              <li key={e.id}>
                <code>{e.eventTable}</code>: {e.justification}
              </li>
            ))}
          </ul>

          <h3>Analyst Notes</h3>
          <ul>
            {notes.map((n) => (
              <li key={n.id}>{n.body}</li>
            ))}
          </ul>
          <form onSubmit={addNote} style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Add a note..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </div>

        <div>
          <h3>Close Incident</h3>
          {incident.status === 'closed' ? (
            <p>This incident is closed. Summary: {incident.summary}</p>
          ) : (
            <form onSubmit={closeIncident} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label>
                Verdict
                <select value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                  <option value="true_positive">True Positive</option>
                  <option value="false_positive">False Positive</option>
                  <option value="benign_positive">Benign Positive</option>
                </select>
              </label>
              <label>
                MITRE Techniques
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginTop: 4 }}>
                  {availableTechniques.map((t) => (
                    <div key={t.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedTechniqueIds.has(t.id)}
                          onChange={() => toggleTechnique(t.id)}
                        />
                        {t.techniqueId} — {t.name}
                        {suggestedTechniqueIds.has(t.id) && (
                          <span style={{ color: '#64748b', fontSize: 12 }}> (suggested by a linked alert)</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </label>
              <textarea
                placeholder="Summary of your findings (min 20 characters)"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                required
                minLength={20}
              />
              {error && <div style={{ color: '#dc2626' }}>{error}</div>}
              <button type="submit">Close Incident</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
