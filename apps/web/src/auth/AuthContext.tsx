import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, mfaApi } from '../api/endpoints';
import { getAccessToken, onTokensChanged, setTokens } from '../api/client';
import type { AuthUser } from '../api/types';

type LoginOutcome = { mfaRequired: false; user: AuthUser } | { mfaRequired: true; mfaChallengeId: string };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  completeMfaLogin: (mfaChallengeId: string, code: string) => Promise<AuthUser>;
  signup: (email: string, password: string, displayName: string, role?: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
  markEmailVerified: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('socverse_user');
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });

  function applySession(result: { accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser }) {
    setTokens(result);
    setUser(result.user);
    localStorage.setItem('socverse_user', JSON.stringify(result.user));
  }

  async function login(email: string, password: string): Promise<LoginOutcome> {
    const result = await authApi.login(email, password);
    if ('mfaRequired' in result) {
      return { mfaRequired: true, mfaChallengeId: result.mfaChallengeId };
    }
    applySession(result);
    return { mfaRequired: false, user: result.user };
  }

  async function completeMfaLogin(mfaChallengeId: string, code: string): Promise<AuthUser> {
    const result = await mfaApi.verify(mfaChallengeId, code);
    applySession(result);
    return result.user;
  }

  async function signup(email: string, password: string, displayName: string, role?: 'student' | 'instructor') {
    await authApi.signup(email, password, displayName, role);
    await login(email, password);
  }

  function logout() {
    setTokens(null);
    setUser(null);
    localStorage.removeItem('socverse_user');
  }

  // Fires on every token change, including a background silent-refresh failure (client.ts's
  // own comment on why) — if the tokens are gone, drop the stale `user` too, so isAuthenticated
  // (and ProtectedRoute's redirect) reflect reality instead of a phantom logged-in state.
  useEffect(() => {
    return onTokensChanged(() => {
      if (!getAccessToken()) {
        setUser(null);
        localStorage.removeItem('socverse_user');
      }
    });
  }, []);

  // Called after a same-tab email verification confirm (§16.2 `POST /auth/email-verification/confirm`)
  // so the catalog's "please verify" gate disappears without requiring a fresh login — the
  // server-side gate itself always re-checks the DB directly, so this is a UI convenience only.
  function markEmailVerified() {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, emailVerified: true };
      localStorage.setItem('socverse_user', JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && getAccessToken()),
        login,
        completeMfaLogin,
        signup,
        logout,
        markEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
