import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated, markEmailVerified } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.confirmEmailVerification(token!);
      if (isAuthenticated) markEmailVerified();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That verification link is invalid or has expired.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Verify your email</h1>
        <p style={{ color: '#dc2626' }}>This link is missing a verification token.</p>
        <p>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Email verified</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>Your email address has been verified.</p>
        <p>
          <Link to={isAuthenticated ? '/catalog' : '/login'}>{isAuthenticated ? 'Go to catalog' : 'Log in'}</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Verify your email</h1>
      <p style={{ color: '#64748b', fontSize: 14 }}>Click below to confirm your email address.</p>
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: '#dc2626', marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Verifying...' : 'Verify email'}
        </button>
      </form>
    </div>
  );
}
