import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, mfaApi } from '../api/endpoints';
import { getAccessToken, setTokens } from '../api/client';
import type { AuthUser } from '../api/types';

type LoginOutcome = { mfaRequired: false; user: AuthUser } | { mfaRequired: true; mfaChallengeId: string };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  completeMfaLogin: (mfaChallengeId: string, code: string) => Promise<AuthUser>;
  signup: (email: string, password: string, displayName: string, role?: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
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

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: Boolean(user && getAccessToken()), login, completeMfaLogin, signup, logout }}
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
