import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { EmailVerificationTokenStore } from './email-verification-token.store';
import { LoginAttemptTracker } from './login-attempt-tracker.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    MfaChallengeStore,
    PasswordResetTokenStore,
    EmailVerificationTokenStore,
    LoginAttemptTracker,
  ],
})
export class AuthModule {}
