// §17.6: the only code path allowed to call the backend. No ad hoc fetch() elsewhere.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

let accessToken: string | null = localStorage.getItem('socverse_access_token');
let refreshToken: string | null = localStorage.getItem('socverse_refresh_token');

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    localStorage.setItem('socverse_access_token', tokens.accessToken);
    localStorage.setItem('socverse_refresh_token', tokens.refreshToken);
  } else {
    localStorage.removeItem('socverse_access_token');
    localStorage.removeItem('socverse_refresh_token');
  }
}

export function getAccessToken() {
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
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

// Every 401 gets exactly one silent-refresh retry (§5.7), then gives up and forces re-login.
async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const response = await rawRequest(path, init);

  if (response.status === 401 && !isRetry && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, true);
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err = body?.error ?? { code: 'UNKNOWN', message: 'Request failed.' };
    throw new ApiError(response.status, err.code, err.message, err.correlationId);
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await rawRequest('/auth/refresh', {
      method: 'POST',
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

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Triggers a browser download for an authenticated file response (e.g. the gradebook CSV,
// §16.13) — outside the JSON `request()` path since the response body isn't JSON.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await rawRequest(path, { method: 'GET' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const err = body?.error ?? { code: 'UNKNOWN', message: 'Download failed.' };
    throw new ApiError(response.status, err.code, err.message, err.correlationId);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
