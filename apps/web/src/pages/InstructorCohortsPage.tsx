import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { instructorApi } from '../api/endpoints';
import type { Cohort } from '../api/types';

export function InstructorCohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    instructorApi
      .listCohorts()
      .then(setCohorts)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function createCohort(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await instructorApi.createCohort(name.trim());
      setName('');
      load();
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p>Loading cohorts...</p>;

  return (
    <div>
      <h1>My Cohorts</h1>
      <form onSubmit={createCohort} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input placeholder="Cohort name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" disabled={creating || !name.trim()}>
          {creating ? 'Creating...' : 'Create Cohort'}
        </button>
      </form>

      <div style={{ display: 'grid', gap: 12 }}>
        {cohorts.map((c) => (
          <Link
            key={c.id}
            to={`/instructor/cohorts/${c.id}`}
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, textDecoration: 'none', color: 'inherit' }}
          >
            <h3 style={{ margin: '0 0 6px' }}>{c.name}</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
              {c.enrollmentCount} student{c.enrollmentCount === 1 ? '' : 's'} · {c.assignmentCount} assignment
              {c.assignmentCount === 1 ? '' : 's'} · Join code: <code>{c.joinCode}</code>
            </p>
          </Link>
        ))}
        {cohorts.length === 0 && <p style={{ color: '#64748b' }}>No cohorts yet. Create one above.</p>}
      </div>
    </div>
  );
}
