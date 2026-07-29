import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { identityPortalApi } from '../api/endpoints';
import type { Identity, SignIn } from '../api/types';
import { SessionNav } from '../components/Layout';

export function IdentityPortalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selected, setSelected] = useState<Identity | null>(null);
  const [signIns, setSignIns] = useState<SignIn[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    identityPortalApi.list(sessionId).then(setIdentities);
  }, [sessionId]);

  async function select(identity: Identity) {
    setSelected(identity);
    const events = await identityPortalApi.getSignIns(sessionId!, identity.id);
    setSignIns(events);
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
              <h3>Sign-in Timeline</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Application</th>
                    <th>Result</th>
                    <th>Travel Speed</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>Select an identity to view its profile.</p>
          )}
        </div>
      </div>
    </div>
  );
}
