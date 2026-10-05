import { Module } from '@nestjs/common';
import { StreaksService } from './streaks.service';

// Service-only, same split as AchievementsModule/CertificatesModule: SessionsService (API
// process) calls recordQualifyingActivity() directly and doesn't need the REST controller or
// its JwtAuthGuard dependency. StreaksController lives in StreaksApiModule, imported only by
// AppModule.
@Module({
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
