import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import Redis from 'ioredis';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { SessionAccessService } from '../../modules/session-core/session-access.service';
import type { AuthenticatedUser } from '../guards/jwt-auth.guard';

const AUTH_TIMEOUT_MS = 10_000;

interface AuthFrame {
  type: 'auth';
  accessToken: string;
}

interface RealtimeGatewayDeps {
  jwtService: JwtService;
  sessionAccess: SessionAccessService;
  config: ConfigService;
}

// §16.16/§5.10: a raw `ws` server (not @nestjs/websockets) so the wire format matches the
// spec's flat `{ "type": "...", ... }` frames exactly, rather than the {event, data}
// envelope NestJS's own WebSocketGateway abstraction would impose. Attached directly to
// the same HTTP server Nest listens on, at `/ws` — outside the `api/v1` prefix, matching
// `wss://.../ws?sessionId={id}` in the doc.
//
// Auth happens via a first-message frame (never a query-param token, which would leak
// into server logs/proxies) after the client connects with `?sessionId=`; the connection
// is authorized using the exact same SessionAccessService check every REST endpoint uses
// (§15.2), so an instructor's cohort-scoped access works here too, not just over REST.
export function attachRealtimeGateway(httpServer: HttpServer, deps: RealtimeGatewayDeps): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const subscriber = new Redis(deps.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  const socketsBySession = new Map<string, Set<WebSocket>>();

  subscriber.on('message', (channel: string, raw: string) => {
    if (!channel.startsWith('session:')) return;
    const sessionId = channel.slice('session:'.length);
    const sockets = socketsBySession.get(sessionId);
    if (!sockets) return;
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(raw);
    }
  });

  wss.on('connection', (socket: WebSocket, request) => {
    const url = new URL(request.url ?? '', 'http://internal');
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      socket.close(4400, 'sessionId query param required');
      return;
    }

    let authenticated = false;
    const authTimer = setTimeout(() => {
      if (!authenticated) socket.close(4401, 'Authentication timed out');
    }, AUTH_TIMEOUT_MS);

    socket.once('message', async (raw: Buffer) => {
      try {
        const frame = JSON.parse(raw.toString()) as Partial<AuthFrame>;
        if (frame.type !== 'auth' || !frame.accessToken) {
          socket.close(4401, 'First message must be an auth frame');
          return;
        }

        const payload = deps.jwtService.verify<{ sub: string; role: string; org_id: string | null; session_version: number }>(
          frame.accessToken,
        );
        const user: AuthenticatedUser = {
          id: payload.sub,
          role: payload.role,
          orgId: payload.org_id,
          sessionVersion: payload.session_version,
        };
        await deps.sessionAccess.getOwnedSession(sessionId, user);

        authenticated = true;
        clearTimeout(authTimer);

        let sockets = socketsBySession.get(sessionId);
        if (!sockets) {
          sockets = new Set();
          socketsBySession.set(sessionId, sockets);
          await subscriber.subscribe(`session:${sessionId}`);
        }
        sockets.add(socket);

        socket.send(JSON.stringify({ type: 'connected' }));

        socket.on('close', () => {
          const remaining = socketsBySession.get(sessionId);
          if (!remaining) return;
          remaining.delete(socket);
          if (remaining.size === 0) {
            socketsBySession.delete(sessionId);
            subscriber.unsubscribe(`session:${sessionId}`).catch(() => {});
          }
        });
      } catch {
        socket.close(4401, 'Authentication failed');
      }
    });
  });
}
