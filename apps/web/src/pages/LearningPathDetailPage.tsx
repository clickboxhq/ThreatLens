import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { learningApi, sessionApi } from '../api/endpoints';
import type { LearningPathDetail } from '../api/types';

export function LearningPathDetailPage() {
  const { pathId } = useParams<{ pathId: string }>();
  const navigate = useNavigate();
  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pathId) return;
    learningApi
      .getPath(pathId)
      .then(setPath)
      .finally(() => setLoading(false));
  }, [pathId]);

  async function startScenario(scenarioId: string) {
    setStartingId(scenarioId);
    const session = await sessionApi.create(scenarioId);
    navigate(`/sessions/${session.id}/dashboard`);
  }

  if (loading) return <p>Loading learning path...</p>;
  if (!path) return <p>Learning path not found.</p>;

  return (
    <div>
      <Link to="/paths">&larr; Back to learning paths</Link>
      <h1>{path.title}</h1>
      <p style={{ color: '#64748b' }}>
        {path.courseTitle} · {path.completedCount}/{path.totalCount} complete · pass threshold {path.passThresholdPercent}%
      </p>

      {path.isComplete && (
        <div style={{ border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <strong>🎉 Path complete!</strong>{' '}
          {path.certificateId ? (
            <>
              Your certificate is ready.{' '}
              <Link to={`/verify/${path.certificateId}`}>View certificate</Link>
            </>
          ) : (
            <span>Your certificate will appear here shortly.</span>
          )}
        </div>
      )}

      <ol style={{ paddingLeft: 20 }}>
        {path.scenarios.map((s) => (
          <li key={s.scenarioId} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <strong>{s.completed ? '✅ ' : ''}{s.title}</strong>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {s.category} · {s.difficulty} · ~{s.estimatedMinutes} min
                  {s.bestPercent != null && ` · best score ${s.bestPercent}%`}
                </div>
              </div>
              <button disabled={startingId === s.scenarioId} onClick={() => startScenario(s.scenarioId)}>
                {startingId === s.scenarioId ? 'Starting...' : s.completed ? 'Retry' : 'Start'}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
