import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { alertsApi, hintsApi, incidentsApi, sessionApi } from '../api/endpoints';
import { connectSessionSocket } from '../api/realtime';
import type { Alert, HintItem, SessionSummary } from '../api/types';
import { SeverityBadge } from '../components/SeverityBadge';
import { SessionNav } from '../components/Layout';

// Still-active safety net for a missed/never-established WebSocket connection (§17.9) —
// slower than before the socket existed, since alert.new/alert.updated pushes are now the
// primary freshness signal, not the only one.
const FALLBACK_POLL_INTERVAL_MS = 10_000;

export function SessionDashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, { summary: string }[]>>({});
  const [creating, setCreating] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('Suspicious activity investigation');
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [hints, setHints] = useState<HintItem[]>([]);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [confirmingHintIndex, setConfirmingHintIndex] = useState<number | null>(null);
  const [unlockingHintIndex, setUnlockingHintIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      const s = await sessionApi.get(sessionId!);
      if (cancelled) return;
      setSession(s);
      if (s.ready) {
        const [a, h] = await Promise.all([alertsApi.list(sessionId!), hintsApi.list(sessionId!)]);
        if (!cancelled) {
          setAlerts(a);
          setHints(h);
        }
      }
    }

    async function poll() {
      await refresh();
      if (cancelled) return;
      // Once ready, this keeps running as the §17.9 fallback in case the socket below
      // never connects or drops silently — the socket is what makes it feel instant.
      timer = setTimeout(poll, FALLBACK_POLL_INTERVAL_MS);
    }
    poll();

    // The Alert Engine publishes one alert.new per alert (§16.16), not one batched
    // message — a scenario with a dozen alerts fires a dozen messages in the same burst,
    // so debounce them into a single refetch instead of one REST round-trip per alert.
    let debounceTimer: ReturnType<typeof setTimeout>;
    const disconnect = connectSessionSocket(sessionId, (message) => {
      if (message.type === 'alert.new' || message.type === 'alert.updated') {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 300);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(debounceTimer);
      disconnect();
    };
  }, [sessionId]);

  async function confirmUnlockHint(index: number) {
    setUnlockingHintIndex(index);
    try {
      const updated = await hintsApi.unlock(sessionId!, index);
      setHints(updated);
      setConfirmingHintIndex(null);
    } finally {
      setUnlockingHintIndex(null);
    }
  }

  function toggleSelected(alertId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  }

  async function viewEvidence(alertId: string) {
    if (expandedEvidence[alertId]) {
      setExpandedEvidence((prev) => {
        const { [alertId]: _removed, ...rest } = prev;
        return rest;
      });
      return;
    }
    const result = await alertsApi.getEvidence(sessionId!, alertId);
    setExpandedEvidence((prev) => ({ ...prev, [alertId]: result.evidence }));
  }

  function startDismiss(alertId: string) {
    setDismissingId(alertId);
    setDismissReason('');
    setDismissError(null);
  }

  async function confirmDismiss(alertId: string) {
    if (dismissReason.trim().length < 10) {
      setDismissError('A dismissal reason of at least 10 characters is required.');
      return;
    }
    const updated = await alertsApi.updateStatus(sessionId!, alertId, 'dismissed', dismissReason.trim());
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
    setDismissingId(null);
  }

  async function createIncidentFromSelected() {
    if (selected.size === 0) return;
    setCreating(true);
    try {
      const title = incidentTitle.trim() || 'Untitled incident';
      const incident = await incidentsApi.create(sessionId!, title);
      await incidentsApi.linkAlerts(sessionId!, incident.id, [...selected]);
      navigate(`/sessions/${sessionId}/incidents/${incident.id}`);
    } finally {
      setCreating(false);
    }
  }

  if (!session) return <p>Loading session...</p>;
  if (!session.ready) return <p>Generating telemetry and evaluating alerts... this page will update automatically.</p>;

  return (
    <div>
      <SessionNav />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1>Alert Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            aria-label="Incident title"
            placeholder="Incident title"
            value={incidentTitle}
            onChange={(e) => setIncidentTitle(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button disabled={selected.size === 0 || creating} onClick={createIncidentFromSelected}>
            {creating ? 'Creating...' : `Create Incident from Selected (${selected.size})`}
          </button>
        </div>
      </div>

      {hints.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginTop: 12, marginBottom: 4 }}>
          <button onClick={() => setHintsOpen((prev) => !prev)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}>
            {hintsOpen ? '▾' : '▸'} Hints{' '}
            <span style={{ fontWeight: 400, color: '#64748b' }}>
              (stuck? hints cost score, never access — {hints.filter((h) => h.unlocked).length}/{hints.length} unlocked)
            </span>
          </button>
          {hintsOpen && (
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {hints.map((hint) => (
                <li key={hint.index} style={{ marginBottom: 8 }}>
                  {hint.unlocked ? (
                    <span>{hint.text}</span>
                  ) : confirmingHintIndex === hint.index ? (
                    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      Unlock this hint for a {hint.unlockCostPercent}% score penalty?
                      <button disabled={unlockingHintIndex === hint.index} onClick={() => confirmUnlockHint(hint.index)}>
                        {unlockingHintIndex === hint.index ? 'Unlocking...' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmingHintIndex(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmingHintIndex(hint.index)}>Unlock hint (-{hint.unlockCostPercent}%)</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
            <th></th>
            <th>Severity</th>
            <th>Title</th>
            <th>Technique</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <>
              <tr key={alert.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td>
                  <input type="checkbox" checked={selected.has(alert.id)} onChange={() => toggleSelected(alert.id)} />
                </td>
                <td>
                  <SeverityBadge severity={alert.severity} />
                </td>
                <td>{alert.title}</td>
                <td>{alert.mitreTechnique ? `${alert.mitreTechnique.techniqueId} — ${alert.mitreTechnique.name}` : '—'}</td>
                <td>{alert.status}</td>
                <td>{new Date(alert.lastSeenAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => viewEvidence(alert.id)}>{expandedEvidence[alert.id] ? 'Hide' : 'Evidence'}</button>{' '}
                  {alert.status !== 'dismissed' && dismissingId !== alert.id && (
                    <button onClick={() => startDismiss(alert.id)}>Dismiss</button>
                  )}
                </td>
              </tr>
              {dismissingId === alert.id && (
                <tr>
                  <td colSpan={7} style={{ background: '#fffbeb', padding: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        aria-label="Dismissal reason"
                        placeholder="Why are you dismissing this alert? (10+ characters, required)"
                        value={dismissReason}
                        onChange={(e) => setDismissReason(e.target.value)}
                        style={{ flex: 1, minWidth: 280 }}
                      />
                      <button onClick={() => confirmDismiss(alert.id)}>Confirm Dismiss</button>
                      <button onClick={() => setDismissingId(null)}>Cancel</button>
                    </div>
                    {dismissError && <div style={{ color: '#dc2626', marginTop: 6 }}>{dismissError}</div>}
                  </td>
                </tr>
              )}
              {expandedEvidence[alert.id] && (
                <tr>
                  <td colSpan={7} style={{ background: '#f8fafc', padding: 10 }}>
                    <strong>Description:</strong> {alert.description}
                    <ul>
                      {expandedEvidence[alert.id].map((e, i) => (
                        <li key={i}>{e.summary}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      {alerts.length === 0 && <p>No alerts generated for this session.</p>}
    </div>
  );
}
