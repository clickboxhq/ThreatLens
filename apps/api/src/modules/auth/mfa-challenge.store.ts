import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

const CHALLENGE_TTL_SECONDS = 5 * 60;

// §16.2: POST /auth/mfa/verify completes login using a short-lived challenge id issued by
// POST /auth/login, rather than re-sending the password. Redis-backed (same pattern as
// RealtimeEventsService) so it survives across API Gateway replicas without standing up a
// dedicated table for state this short-lived and one-time-use.
@Injectable()
export class MfaChallengeStore implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  async create(userId: string): Promise<string> {
    const challengeId = randomUUID();
    await this.redis.set(`mfa-challenge:${challengeId}`, userId, 'EX', CHALLENGE_TTL_SECONDS);
    return challengeId;
  }

  /** One-time use: the challenge is deleted whether or not the caller ultimately supplies a valid code. */
  async consume(challengeId: string): Promise<string | null> {
    const key = `mfa-challenge:${challengeId}`;
    const userId = await this.redis.get(key);
    if (userId) await this.redis.del(key);
    return userId;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
