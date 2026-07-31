import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { leaderboardApi } from '../api/endpoints';
import type { LeaderboardResult } from '../api/types';

const PERIODS: { value: 'weekly' | 'monthly' | 'all_time'; label: string }[] = [
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all_time', label: 'All Time' },
];

export function LeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('all_time');
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    leaderboardApi
      .get(period, 'global')
      .then(setResult)
      .finally(() => setLoading(false));
  }, [period]);

  const inTop = result?.myEntry && result.entries.some((e) => e.userId === result.myEntry!.userId);

  return (
    <div>
      <h1>Leaderboard</h1>
      <p style={{ color: '#64748b' }}>
        Points combine scenario completions, average score, and a difficulty multiplier — a harder scenario is worth
        more than an easy one at the same score.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{ fontWeight: period === p.value ? 700 : 400 }}
            disabled={period === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading leaderboard...</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                <th>Rank</th>
                <th>Student</th>
                <th>Points</th>
                <th>Completions</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {result?.entries.map((e) => (
                <tr
                  key={e.userId}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: e.userId === user?.id ? '#eff6ff' : undefined,
                  }}
                >
                  <td style={{ padding: '6px 0' }}>#{e.rank}</td>
                  <td>
                    {e.displayName}
                    {e.userId === user?.id && ' (you)'}
                  </td>
                  <td>{e.points}</td>
                  <td>{e.completions}</td>
                  <td>{e.averagePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result?.entries.length === 0 && <p style={{ color: '#64748b' }}>No scored sessions yet for this period.</p>}

          {result?.myEntry && !inTop && (
            <p style={{ marginTop: 16, color: '#64748b' }}>
              Your rank: #{result.myEntry.rank} · {result.myEntry.points} points · {result.myEntry.completions} completions
            </p>
          )}
        </>
      )}
    </div>
  );
}
