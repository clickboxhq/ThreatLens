import { useEffect } from "react";
import { create } from "zustand";
import { useHydrated } from "@/hooks/use-hydrated";
import { apiClient, getAccessToken, onTokensChanged, setTokens, tryRefresh } from "./api-client";

export type AuthRole = "student" | "instructor" | "org_admin" | "platform_admin";

export type AuthUser = {
  id: string;
  displayName: string;
  role: AuthRole;
  emailVerified: boolean;
};

type Session = { accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser };
type LoginOutcome =
  { mfaRequired: false; user: AuthUser } | { mfaRequired: true; mfaChallengeId: string };

const USER_STORAGE_KEY = "threatlens_user";

function persistUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_STORAGE_KEY);
}

function readPersistedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

interface AuthState {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  completeMfaLogin: (mfaChallengeId: string, code: string) => Promise<AuthUser>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    role?: "student" | "instructor",
  ) => Promise<{ userId: string; emailVerificationRequired: boolean }>;
  logout: () => void;
  markEmailVerified: () => void;
  requestEmailVerification: () => Promise<void>;
  /** Creating an organization or accepting an invite changes the caller's role server-side —
   * there's no GET /auth/me to re-fetch the user from, so this refreshes the JWT (which does
   * re-read the DB, see api-client.ts's tryRefresh) and patches the cached copy with the role
   * the caller already knows it just became, the same "no fresh login needed" spirit as
   * markEmailVerified(). */
  refreshAfterRoleChange: (role: AuthRole) => Promise<void>;
}

function applySession(result: Session): void {
  setTokens(result);
  persistUser(result.user);
  useAuthStore.setState({ user: result.user });
}

// SSR safety: `user` starts (and on the server, always stays) null. This module is a single
// process-wide store shared across every visitor's request (see api-client.ts's own comment on
// why) — populating it at load time from any request-specific source would leak one visitor's
// identity into every other concurrent request's server-rendered HTML. Real hydration only
// happens client-side, via useAuthHydration() below, after mount — the same
// useHydrated()/HydrationBoundary pattern this app already uses for its other
// Zustand/localStorage-backed state.
export const useAuthStore = create<AuthState>()(() => ({
  user: null,

  async login(email, password) {
    const result = await apiClient.post<Session | { mfaRequired: true; mfaChallengeId: string }>(
      "/auth/login",
      { email, password },
    );
    if ("mfaRequired" in result) {
      return { mfaRequired: true, mfaChallengeId: result.mfaChallengeId };
    }
    applySession(result);
    return { mfaRequired: false, user: result.user };
  },

  async completeMfaLogin(mfaChallengeId, code) {
    const result = await apiClient.post<Session>("/auth/mfa/verify", { mfaChallengeId, code });
    applySession(result);
    return result.user;
  },

  async signup(email, password, displayName, role) {
    const result = await apiClient.post<{ userId: string; emailVerificationRequired: boolean }>(
      "/auth/signup",
      { email, password, displayName, role },
    );
    // SOCVerse issues no session on signup itself (§15.1: email verification is separate from
    // being able to log in at all) — log in right after so the caller lands authenticated.
    await useAuthStore.getState().login(email, password);
    return result;
  },

  logout() {
    setTokens(null);
    persistUser(null);
    useAuthStore.setState({ user: null });
  },

  // Called after a same-tab email verification confirm so the "please verify" gate disappears
  // without a fresh login — the server-side gate itself always re-checks the DB directly, this
  // is a UI convenience only.
  markEmailVerified() {
    const current = useAuthStore.getState().user;
    if (!current) return;
    const updated = { ...current, emailVerified: true };
    persistUser(updated);
    useAuthStore.setState({ user: updated });
  },

  async requestEmailVerification() {
    await apiClient.post("/auth/email-verification/request");
  },

  async refreshAfterRoleChange(role) {
    await tryRefresh();
    const current = useAuthStore.getState().user;
    if (!current) return;
    const updated = { ...current, role };
    persistUser(updated);
    useAuthStore.setState({ user: updated });
  },
}));

/** Mount once near the app root (see routes/__root.tsx) — never per-page. */
export function useAuthHydration(): void {
  useEffect(() => {
    const persisted = readPersistedUser();
    if (persisted && getAccessToken()) {
      useAuthStore.setState({ user: persisted });
    }
    return onTokensChanged(() => {
      if (!getAccessToken()) {
        persistUser(null);
        useAuthStore.setState({ user: null });
      }
    });
  }, []);
}

/** True only once hydrated client-side AND a real token+user both exist. */
export function useIsAuthenticated(): boolean {
  const user = useAuthStore((s) => s.user);
  const hydrated = useHydrated();
  return hydrated && user !== null && getAccessToken() !== null;
}

export function useAuthUser(): AuthUser | null {
  return useAuthStore((s) => s.user);
}
