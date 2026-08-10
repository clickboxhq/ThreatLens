import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';

// Longer-lived than the password reset token (§15.1's 30 min) since verifying an email is a
// low-stakes, non-security-sensitive action a Student might not get to right away — there's no
// analogous "someone else is racing to exploit this window" pressure to keep it short.
const VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

// §15.1 email verification. Redis-backed one-time token, same pattern as PasswordResetTokenStore.
@Injectable()
export class EmailVerificationTokenStore implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(
      `email-verification:${token}`,
      userId,
      'EX',
      VERIFICATION_TOKEN_TTL_SECONDS,
    );
    return token;
  }

  /** One-time use: consumed whether or not the caller goes on to successfully verify. */
  async consume(token: string): Promise<string | null> {
    const key = `email-verification:${token}`;
    const userId = await this.redis.get(key);
    if (userId) await this.redis.del(key);
    return userId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
