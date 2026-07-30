import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { cohortsApi } from '../api/endpoints';
import { ApiError } from '../api/client';

export function JoinCohortPage() {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await cohortsApi.join(joinCode.trim().toUpperCase());
      setSuccess(`Joined "${result.cohortName}".`);
      setTimeout(() => navigate('/catalog'), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join cohort.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 360 }}>
      <h1>Join a Cohort</h1>
      <p style={{ color: '#64748b' }}>Enter the join code your instructor gave you.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          placeholder="Join code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{ textTransform: 'uppercase' }}
          required
        />
        {error && <div style={{ color: '#dc2626' }}>{error}</div>}
        {success && <div style={{ color: '#16a34a' }}>{success}</div>}
        <button type="submit" disabled={submitting || !joinCode.trim()}>
          {submitting ? 'Joining...' : 'Join'}
        </button>
      </form>
    </div>
  );
}
