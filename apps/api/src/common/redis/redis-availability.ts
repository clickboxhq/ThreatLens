import { Logger } from '@nestjs/common';
import { AppException } from '../exceptions/app-exception';

/**
 * Telling "Redis is unavailable" apart from "Redis said no".
 *
 * Written after a production outage on 2026-10-04. The Redis volume's filesystem was forced
 * read-only by the kernel after an I/O error, so Redis refused every write with MISCONF. That
 * is a reasonable default on Redis's part — it stops you running unknowingly without
 * persistence — but every call site treated the rejection as an unhandled error, so signup and
 * login both returned 500 "An unexpected error occurred". Nobody could authenticate for about
 * a day, and the message said nothing a person could act on.
 *
 * The lesson is not "catch Redis errors". It is that Redis holds two different kinds of thing
 * in this application, and they deserve different behaviour when it goes away:
 *
 *   counters   rate limits and lockouts. Advisory. Losing them weakens a defence.
 *   tokens     email verification, password reset, MFA challenges. Load-bearing. A token that
 *              cannot be stored cannot be checked, so continuing would be a lie.
 */

/** Redis replies and connection faults that mean the server cannot serve us, not that we asked wrongly. */
const UNAVAILABLE_PATTERNS = [
  'MISCONF', // snapshotting failed; writes refused (the 2026-10-04 outage)
  'READONLY', // writing to a replica
  'LOADING', // still reading the dataset from disk
  'CLUSTERDOWN',
  'NOREPLICAS',
  'OOM ', // trailing space: the error prefix, not the word inside a message
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'Connection is closed',
  'Stream isn’t writeable',
  "Stream isn't writeable",
  'max retries per request',
];

export function isRedisUnavailable(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string }).code ?? '';
  const haystack = `${code} ${message}`;
  return UNAVAILABLE_PATTERNS.some((p) => haystack.includes(p));
}

/**
 * For advisory state: carry on without it.
 *
 * The trade-off is deliberate and worth stating plainly — while Redis is unavailable, the
 * protection this call provides is simply not there. Brute-force attempts are unmetered. That
 * is accepted because the alternative, demonstrated in production, is that nobody can log in at
 * all, and because the protections that actually matter (password hashing, MFA, session
 * validity) live in Postgres and are untouched by this.
 *
 * Logged at error level, not warn: running without rate limiting is not a routine condition and
 * should be noisy enough to notice before a user reports it.
 */
export async function withoutRedis<T>(
  logger: Logger,
  what: string,
  fallback: T,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isRedisUnavailable(err)) throw err;
    logger.error(
      `Redis unavailable — ${what} skipped. This protection is OFF until Redis recovers. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return fallback;
  }
}

/**
 * For load-bearing state: fail, but say something true.
 *
 * A 503 rather than a 500, because the request was fine and the service is not — and because
 * "try again shortly" is advice a person can act on, where "an unexpected error occurred" is
 * not. Retry-After is set so a client can behave sensibly too.
 */
export async function requireRedis<T>(
  logger: Logger,
  what: string,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isRedisUnavailable(err)) throw err;
    logger.error(
      `Redis unavailable — ${what} cannot proceed. ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    throw new AppException(
      503,
      'SERVICE_TEMPORARILY_UNAVAILABLE',
      'We could not complete that just now because a background service is down. Nothing has changed — please try again in a few minutes.',
      { 'Retry-After': '60' },
    );
  }
}
