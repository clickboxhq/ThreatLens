import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { learningApi, sessionApi } from '../api/endpoints';
import type { MyCertificate, SessionHistoryItem } from '../api/types';

interface ScenarioSummary {
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  attempts: number;
  bestPercent: number | null;
  latestAttemptAt: string;
}

function summarizeByScenario(sessions: SessionHistoryItem[]): ScenarioSummary[] {
  const byScenario = new Map<string, SessionHistoryItem[]>();
  for (const s of sessions) {
    const group = byScenario.get(s.scenarioId) ?? [];
    group.push(s);
    byScenario.set(s.scenarioId, group);
  }

  return [...byScenario.values()]
    .map((group) => {
      const scored = group.filter((s) => s.overallPercent != null);
      const bestPercent = scored.length > 0 ? Math.max(...scored.map((s) => s.overallPercent!)) : null;
      const latest = group.reduce((a, b) => (new Date(a.startedAt) > new Date(b.startedAt) ? a : b));
      return {
        scenarioId: group[0].scenarioId,
        scenarioTitle: group[0].scenarioTitle,
        scenarioCategory: group[0].scenarioCategory,
        attempts: group.length,
        bestPercent,
        latestAttemptAt: latest.startedAt,
      };
    })
    .sort((a, b) => new Date(b.latestAttemptAt).getTime() - new Date(a.latestAttemptAt).getTime());
}

export function ProgressPage() {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [certificates, setCertificates] = useState<MyCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([sessionApi.listMine(), learningApi.myCertificates()])
      .then(([s, c]) => {
        setSessions(s);
        setCertificates(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading your progress...</p>;
  if (sessions.length === 0) {
    return (
      <div>
        <h1>My Progress</h1>
        <p style={{ color: '#64748b' }}>
          You haven't started any scenarios yet. Head to the <Link to="/catalog">catalog</Link> to begin.
        </p>
      </div>
    );
  }

  const byScenario = summarizeByScenario(sessions);

  return (
    <div>
      <h1>My Progress</h1>

      {certificates.length > 0 && (
        <>
          <h3>My Certificates</h3>
          <ul style={{ marginBottom: 32 }}>
            {certificates.map((c) => (
              <li key={c.id}>
                <Link to={`/verify/${c.id}`}>{c.learningPathTitle}</Link> — issued{' '}
                {new Date(c.issuedAt).toLocaleDateString()}
                {c.revoked && ' (revoked)'}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>By Scenario</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
            <th>Scenario</th>
            <th>Category</th>
            <th>Attempts</th>
            <th>Best Score</th>
          </tr>
        </thead>
        <tbody>
          {byScenario.map((s) => (
            <tr key={s.scenarioId} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 0' }}>{s.scenarioTitle}</td>
              <td>{s.scenarioCategory}</td>
              <td>{s.attempts}</td>
              <td>{s.bestPercent != null ? `${s.bestPercent}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>All Attempts</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
            <th>Scenario</th>
            <th>Status</th>
            <th>Score</th>
            <th>Verdict</th>
            <th>Started</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '6px 0' }}>{s.scenarioTitle}</td>
              <td>{s.status}</td>
              <td>{s.overallPercent != null ? `${s.overallPercent}%` : '—'}</td>
              <td>{s.verdictCorrect == null ? '—' : s.verdictCorrect ? 'correct ✓' : 'incorrect ✗'}</td>
              <td>{new Date(s.startedAt).toLocaleString()}</td>
              <td>
                {s.status === 'scored' ? (
                  <Link to={`/sessions/${s.id}/results`}>View Results</Link>
                ) : s.status === 'active' ? (
                  <Link to={`/sessions/${s.id}/dashboard`}>Resume</Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
