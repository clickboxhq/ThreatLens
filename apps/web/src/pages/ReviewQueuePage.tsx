import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { instructorApi } from '../api/endpoints';
import type { ReviewQueueItem } from '../api/types';

export function ReviewQueuePage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cohortId) return;
    instructorApi
      .reviewQueue(cohortId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [cohortId]);

  if (loading) return <p>Loading review queue...</p>;

  return (
    <div>
      <Link to={`/instructor/cohorts/${cohortId}`}>&larr; Back to cohort</Link>
      <h1>Review Queue</h1>
      {items.length === 0 && <p style={{ color: '#64748b' }}>No submitted sessions yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
            <th>Student</th>
            <th>Scenario</th>
            <th>Status</th>
            <th>Score</th>
            <th>Verdict</th>
            <th>Submitted</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.sessionId} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td>
                {item.studentDisplayName} <span style={{ color: '#94a3b8', fontSize: 12 }}>({item.studentEmail})</span>
              </td>
              <td>{item.scenarioTitle}</td>
              <td>{item.status}</td>
              <td>{item.overallPercent != null ? `${item.overallPercent}%` : '—'}</td>
              <td>{item.verdictCorrect == null ? '—' : item.verdictCorrect ? 'correct ✓' : 'incorrect ✗'}</td>
              <td>{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'}</td>
              <td>
                <Link to={`/instructor/sessions/${item.sessionId}/review`}>
                  <button>Review</button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
