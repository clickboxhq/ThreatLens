import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { devicePortalApi, incidentsApi } from '../api/endpoints';
import type { Device, FileEvent, HttpRequest, IncidentSummary, NetworkEvent, ProcessEventNode } from '../api/types';
import { SessionNav } from '../components/Layout';
import { PinEvidenceButton } from '../components/PinEvidenceButton';

interface ProcessTreeViewProps {
  nodes: ProcessEventNode[];
  depth?: number;
  targetIncidentId: string | null;
  pinnedKeys: Set<string>;
  onPinned: (key: string) => void;
}

function ProcessTreeView({ nodes, depth = 0, targetIncidentId, pinnedKeys, onPinned }: ProcessTreeViewProps) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, paddingLeft: depth === 0 ? 0 : 20 }}>
      {nodes.map((node) => (
        <li key={node.id} style={{ marginBottom: 6 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13 }}>{node.imagePath}</div>
            <div style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>{node.commandLine}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {new Date(node.occurredAt).toLocaleTimeString()} · integrity: {node.integrityLevel} · sha256:{' '}
              {node.hashSha256.slice(0, 12)}…
            </div>
            <div style={{ marginTop: 6 }}>
              <PinEvidenceButton
                eventKey={`process_events:${node.id}`}
                eventTable="process_events"
                eventId={node.id}
                incidentId={targetIncidentId}
                pinnedKeys={pinnedKeys}
                onPinned={onPinned}
              />
            </div>
          </div>
          {node.children.length > 0 && (
            <ProcessTreeView
              nodes={node.children}
              depth={depth + 1}
              targetIncidentId={targetIncidentId}
              pinnedKeys={pinnedKeys}
              onPinned={onPinned}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function DevicePortalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [processTree, setProcessTree] = useState<ProcessEventNode[]>([]);
  const [files, setFiles] = useState<FileEvent[]>([]);
  const [network, setNetwork] = useState<NetworkEvent[]>([]);
  const [httpRequests, setHttpRequests] = useState<HttpRequest[]>([]);
  const [isolating, setIsolating] = useState(false);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [targetIncidentId, setTargetIncidentId] = useState<string>('');
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) return;
    devicePortalApi.list(sessionId).then(setDevices);
    incidentsApi.list(sessionId).then((list) => {
      setIncidents(list);
      const openIncident = list.find((i) => i.status !== 'closed');
      if (openIncident) setTargetIncidentId(openIncident.id);
    });
  }, [sessionId]);

  function markPinned(key: string) {
    setPinnedKeys((prev) => new Set(prev).add(key));
  }

  async function select(device: Device) {
    setSelected(device);
    const [tree, fileEvents, networkEvents, httpEvents] = await Promise.all([
      devicePortalApi.getProcessTree(sessionId!, device.id),
      devicePortalApi.getFiles(sessionId!, device.id),
      devicePortalApi.getNetwork(sessionId!, device.id),
      devicePortalApi.getHttpRequests(sessionId!, device.id),
    ]);
    setProcessTree(tree);
    setFiles(fileEvents);
    setNetwork(networkEvents);
    setHttpRequests(httpEvents);
  }

  async function isolate() {
    if (!selected) return;
    setIsolating(true);
    try {
      const updated = await devicePortalApi.isolate(sessionId!, selected.id);
      setSelected(updated);
      setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } finally {
      setIsolating(false);
    }
  }

  return (
    <div>
      <SessionNav />
      <h1>Device Portal</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        <div>
          {devices.map((device) => (
            <div
              key={device.id}
              onClick={() => select(device)}
              style={{
                padding: 10,
                cursor: 'pointer',
                background: selected?.id === device.id ? '#eff6ff' : 'transparent',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ fontWeight: 600 }}>{device.hostname}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {device.osPlatform} · risk: {device.riskLevel}
                {device.isolationStatus === 'isolated' && ' · ISOLATED'}
              </div>
            </div>
          ))}
          {devices.length === 0 && <p style={{ color: '#64748b', fontSize: 14 }}>No devices in this session.</p>}
        </div>

        <div>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>{selected.hostname}</h2>
                <button disabled={isolating || selected.isolationStatus === 'isolated'} onClick={isolate}>
                  {selected.isolationStatus === 'isolated' ? 'Isolated' : isolating ? 'Isolating...' : 'Isolate Device'}
                </button>
              </div>
              <p style={{ color: '#64748b', fontSize: 14 }}>
                {selected.osPlatform} {selected.osVersion} · risk: {selected.riskLevel} · isolation:{' '}
                {selected.isolationStatus}
              </p>

              <h3>Process Tree</h3>
              {processTree.length > 0 ? (
                <ProcessTreeView
                  nodes={processTree}
                  targetIncidentId={targetIncidentId || null}
                  pinnedKeys={pinnedKeys}
                  onPinned={markPinned}
                />
              ) : (
                <p>No process activity recorded.</p>
              )}

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

              <h3>File Timeline</h3>
              {files.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Path</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td>{new Date(f.occurredAt).toLocaleTimeString()}</td>
                        <td>{f.action}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{f.filePath}</td>
                        <td>
                          <PinEvidenceButton
                            eventKey={`file_events:${f.id}`}
                            eventTable="file_events"
                            eventId={f.id}
                            incidentId={targetIncidentId || null}
                            pinnedKeys={pinnedKeys}
                            onPinned={markPinned}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No file activity recorded.</p>
              )}

              <h3>Network Connections</h3>
              {network.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th>Time</th>
                      <th>Direction</th>
                      <th>Remote</th>
                      <th>Bytes Sent / Received</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network.map((n) => (
                      <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td>{new Date(n.occurredAt).toLocaleTimeString()}</td>
                        <td>{n.direction}</td>
                        <td>
                          {n.remoteIp}:{n.remotePort} ({n.protocol})
                        </td>
                        <td>
                          {n.bytesSent} / {n.bytesReceived}
                        </td>
                        <td>
                          <PinEvidenceButton
                            eventKey={`network_events:${n.id}`}
                            eventTable="network_events"
                            eventId={n.id}
                            incidentId={targetIncidentId || null}
                            pinnedKeys={pinnedKeys}
                            onPinned={markPinned}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No network activity recorded.</p>
              )}

              <h3>HTTP Requests</h3>
              {httpRequests.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th>Time</th>
                      <th>Method</th>
                      <th>URL</th>
                      <th>Status</th>
                      <th>User Agent</th>
                      <th>Source IP</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {httpRequests.map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td>{new Date(h.occurredAt).toLocaleTimeString()}</td>
                        <td>{h.method}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{h.url}</td>
                        <td>{h.statusCode}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{h.userAgent}</td>
                        <td>{h.sourceIp}</td>
                        <td>
                          <PinEvidenceButton
                            eventKey={`http_requests:${h.id}`}
                            eventTable="http_requests"
                            eventId={h.id}
                            incidentId={targetIncidentId || null}
                            pinnedKeys={pinnedKeys}
                            onPinned={markPinned}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No HTTP request activity recorded.</p>
              )}
            </>
          ) : (
            <p>Select a device to view its profile.</p>
          )}
        </div>
      </div>
    </div>
  );
}
