import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { certificateApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import type { CertificateVerification } from '../api/types';

export function CertificateVerifyPage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certificateId) return;
    certificateApi
      .verify(certificateId)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this certificate.'))
      .finally(() => setLoading(false));
  }, [certificateId]);

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1>SOCVerse</h1>
      {loading && <p>Checking certificate...</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {result && (
        <div
          style={{
            border: `2px solid ${result.valid ? '#16a34a' : '#dc2626'}`,
            borderRadius: 12,
            padding: 32,
            marginTop: 20,
          }}
        >
          <p style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>
            {result.valid ? 'Verified Certificate' : 'Revoked Certificate'}
          </p>
          <h2 style={{ margin: '8px 0' }}>{result.learnerDisplayName}</h2>
          <p style={{ fontSize: 18 }}>has completed</p>
          <h3 style={{ margin: '8px 0 20px' }}>{result.learningPathTitle}</h3>
          <p style={{ color: '#64748b' }}>Issued {new Date(result.issuedAt).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
}
