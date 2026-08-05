import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const outcome = await login(email, password);
      if (outcome.mfaRequired) {
        setMfaChallengeId(outcome.mfaChallengeId);
      } else {
        navigate(outcome.user.role === 'instructor' ? '/instructor' : '/catalog');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await completeMfaLogin(mfaChallengeId!, mfaCode.trim());
      navigate(user.role === 'instructor' ? '/instructor' : '/catalog');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code is incorrect or has expired.');
    } finally {
      setSubmitting(false);
    }
  }

  if (mfaChallengeId) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Two-Factor Verification</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Enter the 6-digit code from your authenticator app, or one of your recovery codes.
        </p>
        <form onSubmit={handleMfaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Code"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            autoFocus
            required
          />
          {error && <div style={{ color: '#dc2626' }}>{error}</div>}
          <button type="submit" disabled={submitting || mfaCode.trim().length < 6}>
            {submitting ? 'Verifying...' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMfaChallengeId(null);
              setMfaCode('');
              setError(null);
            }}
          >
            Back to login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SOCVerse</h1>
      <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div style={{ color: '#dc2626' }}>{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Log in'}
        </button>
      </form>
      <p>
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      <p>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  );
}
