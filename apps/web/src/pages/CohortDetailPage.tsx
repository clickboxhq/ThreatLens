import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { instructorApi, scenarioApi } from '../api/endpoints';
import type { Cohort, CohortAssignment, RosterEntry, ScenarioSummary } from '../api/types';

export function CohortDetailPage() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [assignments, setAssignments] = useState<CohortAssignment[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [attemptLimit, setAttemptLimit] = useState('');
  const [assigning, setAssigning] = useState(false);

  function load() {
    if (!cohortId) return;
    instructorApi.listCohorts().then((cohorts) => setCohort(cohorts.find((c) => c.id === cohortId) ?? null));
    instructorApi.getRoster(cohortId).then(setRoster);
    instructorApi.listAssignments(cohortId).then(setAssignments);
  }

  useEffect(load, [cohortId]);
  useEffect(() => {
    scenarioApi.list().then((list) => {
      setScenarios(list);
      if (list.length > 0) setScenarioId(list[0].id);
    });
  }, []);

  async function createAssignment(e: FormEvent) {
    e.preventDefault();
    if (!cohortId || !scenarioId) return;
    setAssigning(true);
    try {
      await instructorApi.createAssignment(
        cohortId,
        scenarioId,
        dueAt ? new Date(dueAt).toISOString() : undefined,
        attemptLimit ? Number(attemptLimit) : undefined,
      );
      setDueAt('');
      setAttemptLimit('');
      load();
    } finally {
      setAssigning(false);
    }
  }

  if (!cohort) return <p>Loading cohort...</p>;

  return (
    <div>
      <Link to="/instructor">&larr; Back to cohorts</Link>
      <h1>{cohort.name}</h1>
      <p style={{ color: '#64748b' }}>
        Join code: <code>{cohort.joinCode}</code> — students enter this on the "Join Cohort" page.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Link to={`/instructor/cohorts/${cohort.id}/review`}>
          <button>Review Queue</button>
        </Link>
        <button onClick={() => instructorApi.downloadGradebook(cohort.id, cohort.name)}>Download Gradebook CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Roster ({roster.length})</h3>
          <ul>
            {roster.map((r) => (
              <li key={r.userId}>
                {r.displayName} <span style={{ color: '#94a3b8', fontSize: 12 }}>({r.email})</span>
              </li>
            ))}
          </ul>
          {roster.length === 0 && <p style={{ color: '#64748b', fontSize: 14 }}>No students enrolled yet.</p>}
        </div>

        <div>
          <h3>Assignments</h3>
          <ul>
            {assignments.map((a) => (
              <li key={a.id}>
                {a.scenarioTitle}
                {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleDateString()}`}
                {a.attemptLimit != null && ` · ${a.attemptLimit} attempt${a.attemptLimit === 1 ? '' : 's'}`}
              </li>
            ))}
          </ul>
          {assignments.length === 0 && <p style={{ color: '#64748b', fontSize: 14 }}>No assignments yet.</p>}

          <form onSubmit={createAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} placeholder="Due date (optional)" />
            <input
              type="number"
              min={1}
              value={attemptLimit}
              onChange={(e) => setAttemptLimit(e.target.value)}
              placeholder="Attempt limit (optional)"
            />
            <button type="submit" disabled={assigning || !scenarioId}>
              {assigning ? 'Assigning...' : 'Assign Scenario'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
