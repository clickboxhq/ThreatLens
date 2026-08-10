import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppException } from '../exceptions/app-exception';

// §15.5: "unauthenticated endpoints (login, signup, password reset) limited per-IP tightly
// (e.g., 10/minute) given their abuse potential"; "authenticated endpoints limited per-user...
// with a stricter limit specifically on session-start/telemetry-generation-triggering
// endpoints (§7.7) since each is a real compute cost." A plain Redis fixed-window counter —
// simple and sufficient at this scale; a sliding-window log is the documented upgrade path if
// the windowing precision ever matters more than it does here.
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  /** Throws a 429 AppException with a Retry-After header once `limit` is exceeded within `windowSeconds`. */
  async enforce(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const redisKey = `rate-limit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }

    if (count > limit) {
      const ttl = await this.redis.ttl(redisKey);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      throw new AppException(
        429,
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        {
          'Retry-After': String(retryAfterSeconds),
        },
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
