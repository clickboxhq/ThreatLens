import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { emailPortalApi } from '../api/endpoints';
import type { EmailMessage } from '../api/types';
import { SessionNav } from '../components/Layout';

export function EmailPortalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [showHeaders, setShowHeaders] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    emailPortalApi.list(sessionId).then(setEmails);
  }, [sessionId]);

  return (
    <div>
      <SessionNav />
      <h1>Email Portal</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
        <div>
          {emails.map((email) => (
            <div
              key={email.id}
              onClick={() => {
                setSelected(email);
                setShowHeaders(false);
              }}
              style={{
                padding: 10,
                cursor: 'pointer',
                background: selected?.id === email.id ? '#eff6ff' : 'transparent',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ fontWeight: 600 }}>{email.subject}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{email.senderAddress}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                SPF: {email.spfResult} · DKIM: {email.dkimResult} · DMARC: {email.dmarcResult}
              </div>
            </div>
          ))}
        </div>
        <div>
          {selected ? (
            <>
              <h2>{selected.subject}</h2>
              <p>
                From: {selected.senderDisplayName} &lt;{selected.senderAddress}&gt;
                <br />
                To: {selected.recipientAddresses.join(', ')}
                <br />
                {new Date(selected.occurredAt).toLocaleString()}
              </p>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <strong>Authentication Results</strong>
                <p>
                  SPF: {selected.spfResult} · DKIM: {selected.dkimResult} · DMARC: {selected.dmarcResult}
                </p>
              </div>
              <button onClick={() => setShowHeaders((v) => !v)}>{showHeaders ? 'Hide raw headers' : 'View source'}</button>
              {showHeaders && (
                <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                  {JSON.stringify(selected.headersRaw, null, 2)}
                </pre>
              )}
              {selected.urls.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>URLs</strong>
                  <ul>
                    {selected.urls.map((u) => (
                      <li key={u.id}>
                        {u.displayText} — <code>{u.url}</code> ({u.reputation})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.attachments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Attachments</strong>
                  <ul>
                    {selected.attachments.map((a) => (
                      <li key={a.id}>
                        {a.filename} ({a.contentType}, {a.sizeBytes} bytes) — {a.sandboxVerdict}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div
                style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}
                dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
              />
            </>
          ) : (
            <p>Select a message to read it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
