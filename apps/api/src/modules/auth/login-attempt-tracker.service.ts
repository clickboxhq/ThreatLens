import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { withoutRedis } from '../../common/redis/redis-availability';

// §15.1: "progressive delay + eventual temporary lockout after repeated failed attempts
// (Redis-backed counter keyed by account + IP)". The first THRESHOLD-1 failures are free;
// each one past that doubles the lockout, capped at MAX_LOCKOUT_SECONDS.
export const LOCKOUT_THRESHOLD = 5;
export const ATTEMPT_WINDOW_SECONDS = 15 * 60;
export const BASE_LOCKOUT_SECONDS = 30;
export const MAX_LOCKOUT_SECONDS = 15 * 60;

/** Pure function, unit-testable without Redis — the Redis-backed class below is a thin wrapper around it. */
export function computeLockoutSeconds(
  failureCount: number,
  threshold: number = LOCKOUT_THRESHOLD,
  baseSeconds: number = BASE_LOCKOUT_SECONDS,
  maxSeconds: number = MAX_LOCKOUT_SECONDS,
): number {
  if (failureCount < threshold) return 0;
  const overage = failureCount - threshold;
  return Math.min(baseSeconds * 2 ** overage, maxSeconds);
}

@Injectable()
export class LoginAttemptTracker implements OnModuleDestroy {
  private readonly logger = new Logger(LoginAttemptTracker.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  /** Seconds remaining if this (account, source IP) pair is currently locked out, else 0. */
  async lockoutSecondsRemaining(
    email: string,
    sourceIp: string,
  ): Promise<number> {
    // 0 means "not locked out". Failing open here is what keeps login reachable when Redis is
    // down; the lockout is a defence against guessing, not a correctness requirement.
    const ttl = await withoutRedis(this.logger, 'login lockout check', 0, () =>
      this.redis.ttl(this.lockKey(email, sourceIp)),
    );
    return ttl > 0 ? ttl : 0;
  }

  /** Records a failed attempt and, past the threshold, (re-)applies an escalating lockout. */
  async recordFailure(email: string, sourceIp: string): Promise<void> {
    const countKey = this.countKey(email, sourceIp);
    await withoutRedis(
      this.logger,
      'login failure tally',
      undefined,
      async () => {
        const count = await this.redis.incr(countKey);
        await this.redis.expire(countKey, ATTEMPT_WINDOW_SECONDS); // sliding window: refreshed on every attempt

        const lockoutSeconds = computeLockoutSeconds(count);
        if (lockoutSeconds > 0) {
          await this.redis.set(
            this.lockKey(email, sourceIp),
            '1',
            'EX',
            lockoutSeconds,
          );
        }
      },
    );
  }

  /** Clears the failure count and any active lockout — called on a successful login. */
  async clear(email: string, sourceIp: string): Promise<void> {
    // Already authenticated by this point, so a failure to clear the tally must not turn a
    // successful login into an error.
    await withoutRedis(this.logger, 'login tally reset', undefined, () =>
      this.redis.del(
        this.countKey(email, sourceIp),
        this.lockKey(email, sourceIp),
      ),
    );
  }

  private countKey(email: string, sourceIp: string): string {
    return `login-attempt-count:${email.toLowerCase()}:${sourceIp}`;
  }

  private lockKey(email: string, sourceIp: string): string {
    return `login-lockout:${email.toLowerCase()}:${sourceIp}`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
