import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cohortsApi, scenarioApi, sessionApi } from '../api/endpoints';
import type { MyAssignment, ScenarioSummary } from '../api/types';

export function CatalogPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([scenarioApi.list(), cohortsApi.listMyAssignments()])
      .then(([scenarioList, assignmentList]) => {
        setScenarios(scenarioList);
        setAssignments(assignmentList);
      })
      .finally(() => setLoading(false));
  }, []);

  async function startScenario(scenarioId: string, cohortAssignmentId?: string) {
    setStartingId(cohortAssignmentId ?? scenarioId);
    const session = await sessionApi.create(scenarioId, cohortAssignmentId);
    navigate(`/sessions/${session.id}/dashboard`);
  }

  if (loading) return <p>Loading scenarios...</p>;

  return (
    <div>
      {assignments.length > 0 && (
        <>
          <h1>My Assignments</h1>
          <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
            {assignments.map((a) => {
              const exhausted = a.attemptLimit != null && a.attemptsUsed >= a.attemptLimit;
              return (
                <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ margin: '0 0 4px' }}>{a.scenarioTitle}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                    {a.cohortName}
                    {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleDateString()}`}
                    {a.attemptLimit != null && ` · attempts ${a.attemptsUsed}/${a.attemptLimit}`}
                  </p>
                  <button
                    disabled={exhausted || startingId === a.id}
                    onClick={() => startScenario(a.scenarioId, a.id)}
                    style={{ marginTop: 8 }}
                  >
                    {exhausted ? 'No attempts remaining' : startingId === a.id ? 'Starting...' : 'Start Assignment'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
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
