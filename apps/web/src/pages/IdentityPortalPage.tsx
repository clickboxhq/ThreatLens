import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { identityPortalApi, incidentsApi } from '../api/endpoints';
import type { CloudEvent, Identity, IncidentSummary, SignIn } from '../api/types';
import { SessionNav } from '../components/Layout';
import { PinEvidenceButton } from '../components/PinEvidenceButton';
import { AddToTimelineButton } from '../components/AddToTimelineButton';

export function IdentityPortalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selected, setSelected] = useState<Identity | null>(null);
  const [signIns, setSignIns] = useState<SignIn[]>([]);
  const [cloudEvents, setCloudEvents] = useState<CloudEvent[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [targetIncidentId, setTargetIncidentId] = useState<string>('');
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());
  const [timelineKeys, setTimelineKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) return;
    identityPortalApi.list(sessionId).then(setIdentities);
    incidentsApi.list(sessionId).then((list) => {
      setIncidents(list);
      const openIncident = list.find((i) => i.status !== 'closed');
      if (openIncident) setTargetIncidentId(openIncident.id);
    });
  }, [sessionId]);

  function markPinned(key: string) {
    setPinnedKeys((prev) => new Set(prev).add(key));
  }

  function markAddedToTimeline(key: string) {
    setTimelineKeys((prev) => new Set(prev).add(key));
  }

  async function select(identity: Identity) {
    setSelected(identity);
    const [events, cloud] = await Promise.all([
      identityPortalApi.getSignIns(sessionId!, identity.id),
      identityPortalApi.getCloudEvents(sessionId!, identity.id),
    ]);
    setSignIns(events);
    setCloudEvents(cloud);
  }

  return (
    <div>
      <SessionNav />
      <h1>Identity Portal</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        <div>
          {identities.map((identity) => (
            <div
              key={identity.id}
              onClick={() => select(identity)}
              style={{
                padding: 10,
                cursor: 'pointer',
                background: selected?.id === identity.id ? '#eff6ff' : 'transparent',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ fontWeight: 600 }}>{identity.displayName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {identity.department} · {identity.jobTitle}
              </div>
            </div>
          ))}
        </div>
        <div>
          {selected ? (
            <>
              <h2>{selected.displayName}</h2>
              <p>
                {selected.userPrincipalName} · {selected.department} · MFA: {selected.mfaStatus} · Home:{' '}
                {selected.homeCountry}
              </p>

              {incidents.length > 0 && (
                <label style={{ display: 'block', fontSize: 13, margin: '12px 0' }}>
                  Pin evidence to incident:{' '}
                  <select value={targetIncidentId} onChange={(e) => setTargetIncidentId(e.target.value)}>
                    {incidents.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title} ({i.status})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <h3>Sign-in Timeline</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Application</th>
                    <th>Result</th>
                    <th>Travel Speed</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {signIns.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td>{new Date(s.occurredAt).toLocaleString()}</td>
                      <td>
                        {s.sourceCity}, {s.sourceCountry} ({s.sourceIp})
                      </td>
                      <td>{s.application}</td>
                      <td>{s.result}</td>
                      <td>
                        {s.impliedTravelSpeedKmh
                          ? `${s.impliedTravelSpeedKmh} km/h over ${s.distanceFromPreviousKm} km`
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <PinEvidenceButton
                            eventKey={`sign_in_events:${s.id}`}
                            eventTable="sign_in_events"
                            eventId={s.id}
                            incidentId={targetIncidentId || null}
                            pinnedKeys={pinnedKeys}
                            onPinned={markPinned}
                          />
                          <AddToTimelineButton
                            eventKey={`sign_in_events:${s.id}`}
                            eventTable="sign_in_events"
                            eventId={s.id}
                            incidentId={targetIncidentId || null}
                            addedKeys={timelineKeys}
                            onAdded={markAddedToTimeline}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>Cloud Activity</h3>
              {cloudEvents.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th>Time</th>
                      <th>Provider</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Source IP</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cloudEvents.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td>{new Date(c.occurredAt).toLocaleString()}</td>
                        <td>{c.provider}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.actionName}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.resourceId ?? '—'}</td>
                        <td>{c.sourceIp}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <PinEvidenceButton
                              eventKey={`cloud_events:${c.id}`}
                              eventTable="cloud_events"
                              eventId={c.id}
                              incidentId={targetIncidentId || null}
                              pinnedKeys={pinnedKeys}
                              onPinned={markPinned}
                            />
                            <AddToTimelineButton
                              eventKey={`cloud_events:${c.id}`}
                              eventTable="cloud_events"
                              eventId={c.id}
                              incidentId={targetIncidentId || null}
                              addedKeys={timelineKeys}
                              onAdded={markAddedToTimeline}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No cloud activity recorded.</p>
              )}
            </>
          ) : (
            <p>Select an identity to view its profile.</p>
          )}
        </div>
      </div>
    </div>
  );
}
