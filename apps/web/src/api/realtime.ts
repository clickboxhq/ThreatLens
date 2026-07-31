import { getAccessToken } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

// The realtime gateway is attached directly to the HTTP server at /ws, outside the
// /api/v1 REST prefix (§16.16), so strip the prefix before swapping http(s) for ws(s).
function wsBaseUrl(): string {
  const httpBase = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return httpBase.replace(/^http/, 'ws');
}

export type RealtimeMessage =
  | { type: 'connected' }
  | { type: 'alert.new'; payload: unknown }
  | { type: 'alert.updated'; payload: unknown }
  | { type: 'incident.status_changed'; payload: { id: string; status: string } };

// §5.10/§17.9: a push-notification convenience, never the sole source of truth — every
// caller reacts to a message by refetching over REST, never by trusting the payload as
// the final word. A dropped/never-established connection just means falling back to
// whatever REST polling the caller already does.
export function connectSessionSocket(sessionId: string, onMessage: (message: RealtimeMessage) => void): () => void {
  const token = getAccessToken();
  if (!token) return () => {};

  const socket = new WebSocket(`${wsBaseUrl()}/ws?sessionId=${sessionId}`);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'auth', accessToken: token }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data) as RealtimeMessage;
      onMessage(message);
    } catch {
      // Malformed frame — ignore, REST fallback covers it.
    }
  });

  return () => socket.close();
}
