/**
 * The regression test for the 2026-10-04 authentication outage.
 *
 * Redis refused every write because its volume had been forced read-only by the kernel, and
 * because the rate limiter runs first on signup and login, both endpoints returned 500 before
 * reaching any real logic. Nobody could authenticate for roughly a day.
 *
 * What these assert is not that the helper catches an error — redis-availability.spec covers
 * that. It is that the endpoints stay *reachable*, which is the property that was lost.
 */

// ioredis is mocked at the module level rather than having its methods swapped afterwards:
// the real client connects eagerly and retries forever, which keeps the Jest process alive
// long after the assertions finish.
const redisCalls = {
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => redisCalls),
}));

import { RateLimiterService } from './rate-limiter.service';
import { LoginAttemptTracker } from '../../modules/auth/login-attempt-tracker.service';

const MISCONF = new Error(
  "MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk. Commands that may modify the data set are disabled, because this instance is configured to report errors during writes if RDB snapshotting fails (stop-writes-on-bgsave-error option).",
);

const config = { get: () => 'redis://localhost:6379' } as never;

function silence(svc: unknown) {
  jest
    .spyOn((svc as { logger: { error: () => void } }).logger, 'error')
    .mockImplementation(() => undefined);
}

describe('authentication survives Redis being unavailable', () => {
  let rateLimiter: RateLimiterService;
  let tracker: LoginAttemptTracker;

  beforeEach(() => {
    for (const fn of Object.values(redisCalls)) fn.mockReset();
    redisCalls.quit.mockResolvedValue(undefined);
    for (const name of [
      'incr',
      'expire',
      'ttl',
      'set',
      'del',
      'get',
    ] as const) {
      redisCalls[name].mockRejectedValue(MISCONF);
    }
    rateLimiter = new RateLimiterService(config);
    tracker = new LoginAttemptTracker(config);
    silence(rateLimiter);
    silence(tracker);
  });

  afterEach(async () => {
    // Both services hold a client and implement OnModuleDestroy. Skipping this passes when the
    // file runs alone and leaves a Jest worker alive when it runs alongside everything else —
    // which is how a leaking spec turns into a CI job that never finishes.
    await rateLimiter.onModuleDestroy();
    await tracker.onModuleDestroy();
    jest.restoreAllMocks();
  });

  // This is the one that matters. enforce() is the first thing signup and login call, so if it
  // throws, nothing else runs and the endpoint is simply gone.
  it('the rate limiter lets the request through instead of 500ing', async () => {
    await expect(
      rateLimiter.enforce('signup:1.2.3.4', 10, 60),
    ).resolves.toBeUndefined();
  });

  it('the login lockout check reports "not locked out" rather than failing', async () => {
    await expect(
      tracker.lockoutSecondsRemaining('someone@example.com', '1.2.3.4'),
    ).resolves.toBe(0);
  });

  it('recording a failed attempt does not break the login response', async () => {
    await expect(
      tracker.recordFailure('someone@example.com', '1.2.3.4'),
    ).resolves.toBeUndefined();
  });

  it('clearing the tally does not turn a successful login into an error', async () => {
    // The subtlest one: the user is already authenticated by the time clear() runs, so
    // throwing here would fail a login that had genuinely succeeded.
    await expect(
      tracker.clear('someone@example.com', '1.2.3.4'),
    ).resolves.toBeUndefined();
  });

  it('still rate-limits normally once Redis recovers', async () => {
    // Failing open must not be sticky — the moment Redis answers again, the limit applies.
    redisCalls.incr.mockResolvedValue(11);
    redisCalls.expire.mockResolvedValue(1);
    redisCalls.ttl.mockResolvedValue(30);

    await expect(
      rateLimiter.enforce('signup:1.2.3.4', 10, 60),
    ).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });
});
