import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { requireRedis } from '../../common/redis/redis-availability';

// Longer-lived than the password reset token (§15.1's 30 min) since verifying an email is a
// low-stakes, non-security-sensitive action a Student might not get to right away — there's no
// analogous "someone else is racing to exploit this window" pressure to keep it short.
const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

// §15.1 email verification. Redis-backed one-time token, same pattern as PasswordResetTokenStore.
@Injectable()
export class EmailVerificationTokenStore implements OnModuleDestroy {
  private readonly logger = new Logger(EmailVerificationTokenStore.name);
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    // Load-bearing, unlike a rate-limit counter: a token that was never stored can never be
    // verified, so there is nothing useful to fall back to. Fail with a 503 that says the
    // service is down and nothing was changed, rather than a 500 that says nothing.
    await requireRedis(
      this.logger,
      'storing the email verification token',
      () =>
        this.redis.set(
          `email-verification:${token}`,
          userId,
          'EX',
          VERIFICATION_TOKEN_TTL_SECONDS,
        ),
    );
    return token;
  }

  /** One-time use: consumed whether or not the caller goes on to successfully verify. */
  async consume(token: string): Promise<string | null> {
    const key = `email-verification:${token}`;
    const userId = await requireRedis(
      this.logger,
      'reading the email verification token',
      () => this.redis.get(key),
    );
    if (userId) await this.redis.del(key);
    return userId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
