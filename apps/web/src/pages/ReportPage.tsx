import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportApi } from '../api/endpoints';
import type { IncidentReport } from '../api/types';
import { ApiError } from '../api/client';
import { SessionNav } from '../components/Layout';
import { GlobalTimeline } from '../components/GlobalTimeline';
import { generateIncidentReportPdf, incidentReportPdfFilename } from '../pdf/incidentReportPdf';

// §2.14/§2.19: the report is assembled live from Notes + Evidence Collection + Timeline +
// Verdict rather than a persisted snapshot — safe only because a closed incident is immutable
// (§2.3, enforced server-side in evidence-notes.service.ts / timeline.service.ts).
export function ReportPage() {
  const { sessionId, incidentId } = useParams<{ sessionId: string; incidentId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!sessionId || !incidentId) return;
    reportApi
      .get(sessionId, incidentId)
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load report.'));
  }, [sessionId, incidentId]);

  if (error) {
    return (
      <div>
        <SessionNav />
        <button onClick={() => navigate(`/sessions/${sessionId}/incidents/${incidentId}`)}>&larr; Back to incident</button>
        <p style={{ color: '#dc2626' }}>{error}</p>
      </div>
    );
  }

  if (!report) return <p>Loading report...</p>;

  const { incident } = report;

  async function downloadPdf() {
    if (!report) return;
    setGeneratingPdf(true);
    try {
      const doc = await generateIncidentReportPdf(report);
      doc.save(incidentReportPdfFilename(report));
    } finally {
      setGeneratingPdf(false);
    }
  }

  return (
    <div>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { color: #000; }
        }
      `}</style>
      <div className="no-print">
        <SessionNav />
        <button onClick={() => navigate(`/sessions/${sessionId}/incidents/${incidentId}`)}>&larr; Back to incident</button>
        <button style={{ marginLeft: 8 }} onClick={() => window.print()}>
          Print
        </button>
        <button style={{ marginLeft: 8 }} disabled={generatingPdf} onClick={downloadPdf}>
          {generatingPdf ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </div>

      <h1 style={{ marginBottom: 0 }}>Incident Report: {incident.title}</h1>
      <p style={{ color: '#64748b', marginTop: 4 }}>
        Opened {new Date(incident.createdAt).toLocaleString()} · Closed{' '}
        {incident.closedAt ? new Date(incident.closedAt).toLocaleString() : '—'}
      </p>

      <div style={{ display: 'flex', gap: 24, margin: '16px 0', padding: 12, border: '1px solid #e2e8f0', borderRadius: 6 }}>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Verdict</div>
          <div style={{ fontWeight: 600 }}>{incident.verdict ?? '—'}</div>
        </div>
        {report.score && (
          <>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Score</div>
              <div style={{ fontWeight: 600 }}>{report.score.overallPercent}%</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Verdict Correct</div>
              <div style={{ fontWeight: 600 }}>{report.score.verdictCorrect ? 'Yes' : 'No'}</div>
            </div>
          </>
        )}
      </div>

      <h3>MITRE Techniques</h3>
      {incident.techniques.length === 0 ? (
        <p style={{ color: '#64748b' }}>None tagged.</p>
      ) : (
        <ul>
          {incident.techniques.map((t) => (
            <li key={t.id}>
              {t.techniqueId} — {t.name}
            </li>
          ))}
        </ul>
      )}

      <h3>Summary</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{incident.summary || '—'}</p>

      <h3>Evidence Collection ({report.evidence.length})</h3>
      {report.evidence.length === 0 ? (
        <p style={{ color: '#64748b' }}>No evidence pinned.</p>
      ) : (
        <ul>
          {report.evidence.map((e) => (
            <li key={e.id} style={{ marginBottom: 6 }}>
              <div>{e.summary}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Justification: {e.justification}</div>
            </li>
          ))}
        </ul>
      )}

      <h3>Analyst Notes</h3>
      {report.notes.length === 0 ? (
        <p style={{ color: '#64748b' }}>No notes recorded.</p>
      ) : (
        <ul>
          {report.notes.map((n) => (
            <li key={n.id}>{n.body}</li>
          ))}
        </ul>
      )}

      <h3>Timeline</h3>
      <GlobalTimeline items={report.timeline} incidentId={incidentId!} readOnly />
    </div>
  );
}
