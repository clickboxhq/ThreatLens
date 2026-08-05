import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MfaChallengeStore, PasswordResetTokenStore, LoginAttemptTracker, RateLimiterService],
})
export class AuthModule {}
