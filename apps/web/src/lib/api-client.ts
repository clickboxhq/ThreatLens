// The only code path allowed to call SOCVerse's backend from this app (mirrors the equivalent
// file in the pre-merge apps/web, apps/web/src/api/client.ts in git history) — no ad hoc
// fetch() elsewhere once real domains are wired up in later merge phases.
//
// IMPORTANT — SSR safety: this app is server-rendered (TanStack Start/Nitro), and the Node
// process serving it is long-lived and shared across every visitor's requests, unlike a plain
// SPA where module state is scoped to one browser tab. The token state below (accessToken,
// refreshToken, and the localStorage reads/writes) is safe ONLY when this module runs in the
// browser after hydration — e.g. from a click handler or a client-only effect. NEVER import
// this file's token functions from a server-only context (a TanStack Start `createServerFn`
// handler, a route `loader` running during SSR) — doing so would leak one visitor's session
// into a module-level variable every other concurrent request on the same server process can
// see. Server-side authenticated calls (once any route needs them) must read the caller's own
// token from that request's own cookies/headers, not from this module.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

const isBrowser = typeof window !== "undefined";

let accessToken: string | null = isBrowser ? localStorage.getItem("threatlens_access_token") : null;
let refreshToken: string | null = isBrowser
  ? localStorage.getItem("threatlens_refresh_token")
  : null;

// Plain module state, not reactive Zustand state — anything that needs to re-render when the
// token changes (e.g. an auth-derived `isAuthenticated` selector) should subscribe here rather
// than reading accessToken/refreshToken directly, the same fix applied to the pre-merge app
// after a real bug: a failed background refresh cleared these without anything re-rendering to
// notice, leaving the UI showing a phantom logged-in user while every real request 401'd.
const listeners = new Set<() => void>();

export function onTokensChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null): void {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (isBrowser) {
    if (tokens) {
      localStorage.setItem("threatlens_access_token", tokens.accessToken);
      localStorage.setItem("threatlens_refresh_token", tokens.refreshToken);
    } else {
      localStorage.removeItem("threatlens_access_token");
      localStorage.removeItem("threatlens_refresh_token");
    }
  }
  listeners.forEach((listener) => listener());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  code: string;
  correlationId?: string;

  constructor(status: number, code: string, message: string, correlationId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

// Every 401 gets exactly one silent-refresh retry, then gives up — caller sees the ApiError and
// (once real auth pages exist, Phase 2) sends the user back to /login.
async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const response = await rawRequest(path, init);

  if (response.status === 401 && !isRetry && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, true);
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err = body?.error ?? { code: "UNKNOWN", message: "Request failed." };
    throw new ApiError(response.status, err.code, err.message, err.correlationId);
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await rawRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      setTokens(null);
      return false;
    }
    const tokens = await response.json();
    setTokens(tokens);
    return true;
  } catch {
    setTokens(null);
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Triggers a browser download for an authenticated file response (e.g. the instructor
// gradebook CSV) — outside the JSON request() path since the response body isn't JSON.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await rawRequest(path, { method: "GET" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const err = body?.error ?? { code: "UNKNOWN", message: "Download failed." };
    throw new ApiError(response.status, err.code, err.message, err.correlationId);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
