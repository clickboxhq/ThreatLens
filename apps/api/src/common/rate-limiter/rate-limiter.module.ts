import { Global, Module } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter.service';

// Global for the same reason as AuditLogModule/SessionCoreModule: used by unrelated modules
// (auth, sessions, and any future compute-triggering endpoint) that shouldn't depend on each
// other just to share this.
@Global()
@Module({
  providers: [RateLimiterService],
  exports: [RateLimiterService],
})
export class RateLimiterModule {}
