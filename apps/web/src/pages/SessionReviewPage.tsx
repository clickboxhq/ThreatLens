import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { incidentsApi, instructorApi, sessionApi, timelineApi } from '../api/endpoints';
import type { AnalystNote, EvidenceItem, Incident, InstructorFeedbackItem, ScoreResult, TimelineItem } from '../api/types';
import { GlobalTimeline } from '../components/GlobalTimeline';

interface IncidentBlock {
  incident: Incident;
  evidence: EvidenceItem[];
  notes: AnalystNote[];
  timeline: TimelineItem[];
  feedback: InstructorFeedbackItem[];
}

const RUBRIC_FIELDS: { key: string; label: string }[] = [
  { key: 'techniqueAccuracyPercent', label: 'Technique Accuracy %' },
  { key: 'evidencePrecisionPercent', label: 'Evidence Precision %' },
  { key: 'evidenceRecallPercent', label: 'Evidence Recall %' },
  { key: 'falsePositiveHandlingPercent', label: 'False-Positive Handling %' },
  { key: 'responsePercent', label: 'Response / Containment %' },
];

function FeedbackForm({ incidentId, onSubmitted }: { incidentId: string; onSubmitted: (fb: InstructorFeedbackItem[]) => void }) {
  const [comment, setComment] = useState('');
  const [reopen, setReopen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const rubricOverrides: Record<string, number> = {};
      for (const field of RUBRIC_FIELDS) {
        const raw = overrides[field.key];
        if (raw != null && raw !== '') rubricOverrides[field.key] = Number(raw);
      }
      const result = await instructorApi.submitFeedback(incidentId, {
        comment: comment.trim() || undefined,
        reopenSession: reopen,
        rubricOverrides: Object.keys(rubricOverrides).length > 0 ? rubricOverrides : undefined,
      });
      onSubmitted(result);
      setComment('');
      setReopen(false);
      setOverrides({});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      <textarea
        placeholder="Feedback for the student..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {RUBRIC_FIELDS.map((field) => (
          <label key={field.key} style={{ fontSize: 12, color: '#64748b' }}>
            {field.label} override
            <input
              type="number"
              min={0}
              max={100}
              value={overrides[field.key] ?? ''}
              onChange={(e) => setOverrides((prev) => ({ ...prev, [field.key]: e.target.value }))}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        ))}
      </div>
      <label style={{ fontSize: 14 }}>
        <input type="checkbox" checked={reopen} onChange={(e) => setReopen(e.target.checked)} /> Reopen this incident for
        the student to revise
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </form>
  );
}

export function SessionReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [blocks, setBlocks] = useState<IncidentBlock[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const summaries = await incidentsApi.list(sessionId);
      const details = await Promise.all(
        summaries.map(async (s) => {
          const [incident, evidence, notes, timeline, feedback] = await Promise.all([
            incidentsApi.get(sessionId, s.id),
            incidentsApi.listEvidence(sessionId, s.id),
            incidentsApi.listNotes(sessionId, s.id),
            timelineApi.list(sessionId, s.id),
            incidentsApi.listFeedback(sessionId, s.id),
          ]);
          return { incident, evidence, notes, timeline, feedback };
        }),
      );
      setBlocks(details);
      sessionApi
        .getScore(sessionId)
        .then(setScore)
        .catch(() => setScore(null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) return <p>Loading session...</p>;

  return (
    <div>
      <h1>Session Review</h1>

      {score ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{score.overallPercent}%</div>
          <p>Verdict {score.verdictCorrect ? 'correct ✓' : 'incorrect ✗'}</p>
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Technique {score.techniqueAccuracyPercent}% · Precision {score.evidencePrecisionPercent}% · Recall{' '}
            {score.evidenceRecallPercent}%
          </p>
        </div>
      ) : (
        <p style={{ color: '#64748b' }}>Not yet scored.</p>
      )}

      {blocks.map(({ incident, evidence, notes, timeline, feedback }) => (
        <div key={incident.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <h3 style={{ marginTop: 0 }}>{incident.title}</h3>
            {incident.status === 'closed' && (
              <Link to={`/sessions/${sessionId}/incidents/${incident.id}/report`}>View Full Report</Link>
            )}
          </div>
          <p>
            Status: {incident.status} {incident.verdict && `· Verdict: ${incident.verdict}`}
          </p>
          {incident.summary && <p style={{ color: '#475569' }}>{incident.summary}</p>}
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Techniques: {incident.techniques.map((t) => t.techniqueId).join(', ') || 'none tagged'}
          </p>

          <h4>Evidence ({evidence.length})</h4>
          <ul>
            {evidence.map((e) => (
              <li key={e.id}>
                <code>{e.eventTable}</code>: {e.justification}
              </li>
            ))}
          </ul>

          <h4>Analyst Notes ({notes.length})</h4>
          {notes.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No notes recorded.</p>
          ) : (
            <ul>
              {notes.map((n) => (
                <li key={n.id}>{n.body}</li>
              ))}
            </ul>
          )}

          <h4>Timeline</h4>
          <GlobalTimeline items={timeline} incidentId={incident.id} readOnly />

          {feedback.length > 0 && (
            <>
              <h4>Prior Feedback</h4>
              <ul>
                {feedback.map((f) => (
                  <li key={f.id}>
                    <strong>{f.instructorDisplayName}:</strong> {f.comment}
                    {f.reopenedSession && ' (reopened)'}
                  </li>
                ))}
              </ul>
            </>
          )}

          <FeedbackForm
            incidentId={incident.id}
            onSubmitted={(fb) =>
              setBlocks((prev) => prev.map((b) => (b.incident.id === incident.id ? { ...b, feedback: fb } : b)))
            }
          />
        </div>
      ))}

      {blocks.length === 0 && <p style={{ color: '#64748b' }}>No incidents in this session.</p>}
    </div>
  );
}
