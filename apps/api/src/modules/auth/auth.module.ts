import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';

@Module({
  controllers: [AuthController],
  providers: [AuthService, MfaChallengeStore],
})
export class AuthModule {}
