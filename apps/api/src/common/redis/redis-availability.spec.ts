import { Logger } from '@nestjs/common';
import {
  isRedisUnavailable,
  withoutRedis,
  requireRedis,
} from './redis-availability';

// The real reply that took authentication down on 2026-10-04, copied verbatim. The volume's
// filesystem had been forced read-only by the kernel, so every write was refused — and every
// call site turned that into a 500 "An unexpected error occurred".
const MISCONF = new Error(
  "MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk. Commands that may modify the data set are disabled, because this instance is configured to report errors during writes if RDB snapshotting fails (stop-writes-on-bgsave-error option). Please check the Redis logs for details about the RDB error.",
);

function silentLogger(): Logger {
  const l = new Logger('test');
  jest.spyOn(l, 'error').mockImplementation(() => undefined);
  return l;
}

describe('isRedisUnavailable', () => {
  it('recognises the MISCONF reply from the outage', () => {
    expect(isRedisUnavailable(MISCONF)).toBe(true);
  });

  it.each([
    [
      'connection refused',
      Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    ],
    ['closed connection', new Error('Connection is closed.')],
    [
      'replica write',
      new Error("READONLY You can't write against a read only replica."),
    ],
    [
      'still loading',
      new Error('LOADING Redis is loading the dataset in memory'),
    ],
    [
      'retries exhausted',
      new Error('Reached the max retries per request limit'),
    ],
  ])('recognises %s', (_label, err) => {
    expect(isRedisUnavailable(err)).toBe(true);
  });

  it('does not swallow ordinary programming errors', () => {
    // The point of the check is to be narrow. A typo in a key or a bad argument must still
    // surface as a real failure rather than being quietly treated as an outage.
    expect(isRedisUnavailable(new TypeError('key is not a string'))).toBe(
      false,
    );
    expect(
      isRedisUnavailable(new Error('WRONGTYPE Operation against a key')),
    ).toBe(false);
    expect(isRedisUnavailable(null)).toBe(false);
  });
});

describe('withoutRedis — advisory state', () => {
  it('returns the fallback when Redis is unavailable', async () => {
    const result = await withoutRedis(silentLogger(), 'rate limit', 1, () => {
      throw MISCONF;
    });
    expect(result).toBe(1);
  });

  it('logs at error level, because running unprotected should be noticed', async () => {
    const logger = silentLogger();
    await withoutRedis(logger, 'rate limit', 1, () => {
      throw MISCONF;
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('protection is OFF'),
    );
  });

  it('still throws anything that is not an availability problem', async () => {
    const boom = new TypeError('bad key');
    await expect(
      withoutRedis(silentLogger(), 'rate limit', 1, () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });

  it('passes the value straight through when Redis is healthy', async () => {
    const result = await withoutRedis(
      silentLogger(),
      'rate limit',
      1,
      async () => 7,
    );
    expect(result).toBe(7);
  });
});

describe('requireRedis — load-bearing state', () => {
  it('fails with 503 and a message a person can act on', async () => {
    // Not 500: the request was fine, the service is not. And not "an unexpected error
    // occurred", which is what the signup form showed for a day.
    await expect(
      requireRedis(silentLogger(), 'storing the token', () => {
        throw MISCONF;
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
    });
  });

  it('tells the caller nothing was changed', async () => {
    await expect(
      requireRedis(silentLogger(), 'storing the token', () => {
        throw MISCONF;
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Nothing has changed'),
    });
  });

  it('still throws anything that is not an availability problem', async () => {
    const boom = new TypeError('bad key');
    await expect(
      requireRedis(silentLogger(), 'storing the token', () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
