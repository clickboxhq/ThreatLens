import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { requireRedis } from '../../common/redis/redis-availability';

const RESET_TOKEN_TTL_SECONDS = 30 * 60;

// §15.1/§16.2 password reset. Redis-backed one-time token, same pattern as
// MfaChallengeStore — short-lived, single-use state that doesn't need a durable table.
@Injectable()
export class PasswordResetTokenStore implements OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetTokenStore.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    // A reset token that was never stored cannot be redeemed, so there is no safe fallback —
    // the caller is told the service is down rather than handed a link that will not work.
    await requireRedis(this.logger, 'storing the password reset token', () =>
      this.redis.set(
        `password-reset:${token}`,
        userId,
        'EX',
        RESET_TOKEN_TTL_SECONDS,
      ),
    );
    return token;
  }

  /** One-time use: consumed whether or not the caller goes on to successfully reset the password. */
  async consume(token: string): Promise<string | null> {
    const key = `password-reset:${token}`;
    const userId = await requireRedis(
      this.logger,
      'reading the password reset token',
      () => this.redis.get(key),
    );
    if (userId) await this.redis.del(key);
    return userId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
