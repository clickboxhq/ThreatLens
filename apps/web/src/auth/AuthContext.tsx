import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { getAccessToken, setTokens } from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (email: string, password: string, displayName: string, role?: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('socverse_user');
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    setTokens(result);
    setUser(result.user);
    localStorage.setItem('socverse_user', JSON.stringify(result.user));
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
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user && getAccessToken()), login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
