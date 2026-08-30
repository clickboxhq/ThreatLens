import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

const CHALLENGE_TTL_SECONDS = 5 * 60;
// Enrolment is a longer sit-down than typing a code: scan a QR, wait for a fresh code, and —
// critically for a privileged account with no reset path — actually write the recovery codes
// down somewhere safe. Rushing that is how people end up permanently locked out.
const ENROLMENT_TTL_SECONDS = 15 * 60;

// §16.2: POST /auth/mfa/verify completes login using a short-lived challenge id issued by
// POST /auth/login, rather than re-sending the password. Redis-backed (same pattern as
// RealtimeEventsService) so it survives across API Gateway replicas without standing up a
// dedicated table for state this short-lived and one-time-use.
@Injectable()
export class MfaChallengeStore implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
    );
  }

  async create(userId: string): Promise<string> {
    const challengeId = randomUUID();
    await this.redis.set(
      `mfa-challenge:${challengeId}`,
      userId,
      'EX',
      CHALLENGE_TTL_SECONDS,
    );
    return challengeId;
  }

  /**
   * A challenge issued when an account whose role REQUIRES MFA logs in without having enrolled
   * yet. It is handed out only after the password has been verified, so it carries exactly the
   * trust of a completed password check and nothing more: it permits enrolling MFA on that one
   * account and grants no other access.
   *
   * This exists because enforcing MFA at login would otherwise be a trap — the setup endpoints
   * need a token, and the token is what is being withheld. Without this an admin would be
   * unable to log in and unable to enrol.
   */
  async createEnrolment(userId: string): Promise<string> {
    const challengeId = randomUUID();
    await this.redis.set(
      `mfa-enrolment:${challengeId}`,
      userId,
      'EX',
      ENROLMENT_TTL_SECONDS,
    );
    return challengeId;
  }

  /** Read without consuming — setup can legitimately be retried (wrong app, bad scan). */
  async peekEnrolment(challengeId: string): Promise<string | null> {
    return this.redis.get(`mfa-enrolment:${challengeId}`);
  }

  /** Consumed once enrolment actually completes. */
  async consumeEnrolment(challengeId: string): Promise<string | null> {
    const key = `mfa-enrolment:${challengeId}`;
    const userId = await this.redis.get(key);
    if (userId) await this.redis.del(key);
    return userId;
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
