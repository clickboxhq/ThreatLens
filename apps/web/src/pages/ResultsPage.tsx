import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sessionApi } from '../api/endpoints';
import type { ScoreResult } from '../api/types';
import { SessionNav } from '../components/Layout';

const POLL_INTERVAL_MS = 2000;

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [score, setScore] = useState<ScoreResult | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const result = await sessionApi.getScore(sessionId!);
        if (!cancelled) setScore(result);
      } catch {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  if (!score) {
    return (
      <div>
        <SessionNav />
        <p>Scoring in progress...</p>
      </div>
    );
  }

  const rows: [string, number][] = [
    ['Technique Accuracy', score.techniqueAccuracyPercent],
    ['Evidence Precision', score.evidencePrecisionPercent],
    ['Evidence Recall', score.evidenceRecallPercent],
    ['False-Positive Handling', score.rubricBreakdown.falsePositiveHandlingPercent],
    ['Response / Containment', score.rubricBreakdown.responsePercent],
  ];

  return (
    <div>
      <SessionNav />
      <h1>Results</h1>
      <div style={{ fontSize: 48, fontWeight: 700 }}>{score.overallPercent}%</div>
      <p>Verdict {score.verdictCorrect ? 'correct ✓' : 'incorrect ✗'}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 0' }}>{label}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{value}%</td>
            </tr>
          ))}
          {score.hintPenaltyPercent > 0 && (
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '8px 0' }}>Hint Penalty</td>
              <td style={{ padding: '8px 0', textAlign: 'right', color: '#dc2626' }}>-{score.hintPenaltyPercent}%</td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: '#64748b' }}>
        False positives mishandled: {score.falsePositiveCount} · Time to resolution:{' '}
        {Math.round(score.timeToResolutionSeconds / 60)} minutes
      </p>

      {score.rubricBreakdown.missedTechniques.length > 0 && (
        <div style={{ marginTop: 24, padding: 12, border: '1px solid #fecaca', borderRadius: 6, background: '#fef2f2' }}>
          <h3 style={{ margin: '0 0 8px' }}>Techniques You Missed</h3>
          <ul style={{ margin: 0 }}>
            {score.rubricBreakdown.missedTechniques.map((t) => (
              <li key={t.id}>
                {t.techniqueId} — {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {score.rubricBreakdown.missedEvidence.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #fecaca', borderRadius: 6, background: '#fef2f2' }}>
          <h3 style={{ margin: '0 0 8px' }}>Evidence You Missed ({score.rubricBreakdown.missedEvidence.length})</h3>
          <ul style={{ margin: 0 }}>
            {score.rubricBreakdown.missedEvidence.map((e, i) => (
              <li key={i}>{e.summary}</li>
            ))}
          </ul>
        </div>
      )}

      {score.rubricBreakdown.missedTechniques.length === 0 && score.rubricBreakdown.missedEvidence.length === 0 && (
        <p style={{ marginTop: 16, color: '#16a34a' }}>You caught every required technique and every piece of ground-truth evidence.</p>
      )}
    </div>
  );
}
