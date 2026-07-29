import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scenarioApi, sessionApi } from '../api/endpoints';
import type { ScenarioSummary } from '../api/types';

export function CatalogPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    scenarioApi
      .list()
      .then(setScenarios)
      .finally(() => setLoading(false));
  }, []);

  async function startScenario(scenarioId: string) {
    setStartingId(scenarioId);
    const session = await sessionApi.create(scenarioId);
    navigate(`/sessions/${session.id}/dashboard`);
  }

  if (loading) return <p>Loading scenarios...</p>;

  return (
    <div>
      <h1>Scenario Catalog</h1>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {scenarios.map((s) => (
          <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>{s.category}</span>
              <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#64748b' }}>{s.difficulty}</span>
            </div>
            <h3 style={{ marginTop: 0 }}>{s.title}</h3>
            <p style={{ color: '#475569', fontSize: 14 }}>{s.summary}</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>~{s.estimatedMinutes} min</p>
            <button disabled={startingId === s.id} onClick={() => startScenario(s.id)}>
              {startingId === s.id ? 'Starting...' : 'Start Scenario'}
            </button>
          </div>
        ))}
      </div>
      {scenarios.length === 0 && <p>No published scenarios yet.</p>}
    </div>
  );
}
