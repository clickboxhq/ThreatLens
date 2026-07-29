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
        </tbody>
      </table>
      <p style={{ marginTop: 16, color: '#64748b' }}>
        False positives mishandled: {score.falsePositiveCount} · Time to resolution:{' '}
        {Math.round(score.timeToResolutionSeconds / 60)} minutes
      </p>
    </div>
  );
}
