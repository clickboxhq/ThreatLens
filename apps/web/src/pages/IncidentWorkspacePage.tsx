import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { alertsApi, incidentsApi, mitreApi, timelineApi } from '../api/endpoints';
import { connectSessionSocket } from '../api/realtime';
import type { Alert, AnalystNote, EvidenceItem, Incident, InstructorFeedbackItem, MitreTechniqueRef, TimelineItem } from '../api/types';
import { ApiError } from '../api/client';
import { SessionNav } from '../components/Layout';
import { AddToTimelineButton } from '../components/AddToTimelineButton';
import { GlobalTimeline } from '../components/GlobalTimeline';

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
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [timelineKeys, setTimelineKeys] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<AnalystNote[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [verdict, setVerdict] = useState('true_positive');
  const [summary, setSummary] = useState('');
  const [selectedTechniqueIds, setSelectedTechniqueIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pinningEventId, setPinningEventId] = useState<string | null>(null);
  const [justificationDraft, setJustificationDraft] = useState('');
  const [allTechniques, setAllTechniques] = useState<MitreTechniqueRef[]>([]);
  const [instructorFeedback, setInstructorFeedback] = useState<InstructorFeedbackItem[]>([]);

  async function load() {
    if (!sessionId || !incidentId) return;
    const [inc, allAlerts, ev, timeline, allNotes, techniques, feedback] = await Promise.all([
      incidentsApi.get(sessionId, incidentId),
      alertsApi.list(sessionId),
      incidentsApi.listEvidence(sessionId, incidentId),
      timelineApi.list(sessionId, incidentId),
      incidentsApi.listNotes(sessionId, incidentId),
      mitreApi.list(),
      incidentsApi.listFeedback(sessionId, incidentId),
    ]);
    setIncident(inc);
    setEvidence(ev);
    setTimelineItems(timeline);
    setTimelineKeys(new Set(timeline.filter((t) => t.source.includes('manual')).map((t) => `${t.eventTable}:${t.id}`)));
    setNotes(allNotes);
    setAllTechniques(techniques);
    setInstructorFeedback(feedback);

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

  useEffect(() => {
    if (!sessionId || !incidentId) return;
    // §16.16: an instructor reopening this exact incident while the Student is sitting on
    // this page is the concrete case this exists for — refetch rather than trust the
    // pushed payload, so the UI picks up the new status, feedback, and re-openable form.
    return connectSessionSocket(sessionId, (message) => {
      if (message.type === 'incident.status_changed' && message.payload.id === incidentId) {
        load();
      }
    });
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

  async function refreshTimeline() {
    if (!sessionId || !incidentId) return;
    const timeline = await timelineApi.list(sessionId, incidentId);
    setTimelineItems(timeline);
    setTimelineKeys(new Set(timeline.filter((t) => t.source.includes('manual')).map((t) => `${t.eventTable}:${t.id}`)));
  }

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
              <span style={{ marginLeft: 6 }}>
                <AddToTimelineButton
                  eventKey={`${c.eventTable}:${c.eventId}`}
                  eventTable={c.eventTable}
                  eventId={c.eventId}
                  incidentId={incidentId ?? null}
                  addedKeys={timelineKeys}
                  onAdded={() => refreshTimeline()}
                />
              </span>
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

          {instructorFeedback.length > 0 && (
            <>
              <h3>Instructor Feedback</h3>
              <ul>
                {instructorFeedback.map((f) => (
                  <li key={f.id} style={{ marginBottom: 8 }}>
                    <strong>{f.instructorDisplayName}</strong>
                    {f.comment && <p style={{ margin: '4px 0' }}>{f.comment}</p>}
                    {f.rubricOverrides && (
                      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                        Score overrides: {Object.entries(f.rubricOverrides).map(([k, v]) => `${k}: ${v}%`).join(', ')}
                      </p>
                    )}
                    {f.reopenedSession && <p style={{ margin: '4px 0', color: '#b45309' }}>This incident was reopened for revision.</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h3>Close Incident</h3>
          {incident.status === 'closed' ? (
            <div>
              <p>This incident is closed. Summary: {incident.summary}</p>
              <button onClick={() => navigate(`/sessions/${sessionId}/incidents/${incidentId}/report`)}>
                View Final Report
              </button>
            </div>
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

      <div style={{ marginTop: 24 }}>
        <h3>Global Timeline</h3>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: -6 }}>
          Grouped by identity/device/mailbox lane, in chronological order. Items with a matching colored border share a
          correlated origin.
        </p>
        <GlobalTimeline items={timelineItems} incidentId={incidentId!} onRemoved={() => refreshTimeline()} />
      </div>
    </div>
  );
}
