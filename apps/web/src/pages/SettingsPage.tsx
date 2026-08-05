import { useEffect, useState } from 'react';
import { mfaApi } from '../api/endpoints';
import type { MfaSetup, MfaStatus } from '../api/types';
import { ApiError } from '../api/client';

export function SettingsPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mfaApi.status().then(setStatus);
  }, []);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await mfaApi.setup());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start MFA setup.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setError(null);
    setBusy(true);
    try {
      const result = await mfaApi.enable(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      setCode('');
      setStatus(await mfaApi.status());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code is incorrect or has expired.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    setError(null);
    setBusy(true);
    try {
      await mfaApi.disable(disablePassword);
      setDisabling(false);
      setDisablePassword('');
      setStatus(await mfaApi.status());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disable MFA.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Settings</h1>
      <h2>Two-Factor Authentication</h2>

      {!status ? (
        <p>Loading...</p>
      ) : recoveryCodes ? (
        <div>
          <p style={{ fontWeight: 600 }}>
            Two-factor authentication is now enabled. Save these recovery codes somewhere safe — each one can be used
            once if you lose access to your authenticator app. They will not be shown again.
          </p>
          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, fontSize: 14 }}>
            {recoveryCodes.join('\n')}
          </pre>
          <button onClick={() => setRecoveryCodes(null)}>I've saved my recovery codes</button>
        </div>
      ) : status.enabled ? (
        <div>
          <p style={{ color: '#16a34a' }}>Two-factor authentication is enabled on your account.</p>
          {status.mandatory ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>
              MFA is mandatory for your account's role and cannot be disabled.
            </p>
          ) : !disabling ? (
            <button onClick={() => setDisabling(true)}>Disable Two-Factor Authentication</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
              <input
                type="password"
                placeholder="Confirm your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
              />
              {error && <div style={{ color: '#dc2626' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={busy || disablePassword.length === 0} onClick={confirmDisable}>
                  Confirm Disable
                </button>
                <button
                  onClick={() => {
                    setDisabling(false);
                    setDisablePassword('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !setup ? (
        <div>
          <p style={{ color: '#64748b' }}>
            Two-factor authentication is not enabled. Add it for extra protection against a stolen password.
          </p>
          <button disabled={busy} onClick={startSetup}>
            Enable Two-Factor Authentication
          </button>
        </div>
      ) : (
        <div style={{ maxWidth: 360 }}>
          <p>Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy, etc.):</p>
          <img src={setup.qrCodeDataUrl} alt="MFA enrollment QR code" width={200} height={200} />
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Can't scan? Enter this code manually: <code>{setup.secret}</code>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="Enter the 6-digit code from your app"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <div style={{ color: '#dc2626' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={busy || code.trim().length !== 6} onClick={confirmEnable}>
                Confirm & Enable
              </button>
              <button
                onClick={() => {
                  setSetup(null);
                  setCode('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
