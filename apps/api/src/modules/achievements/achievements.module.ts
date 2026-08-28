import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';

// Service-only, same split as CertificatesModule (see its own comment): a consumer that only
// needs checkAndIssue() (ScoringModule, on session scoring) shouldn't also pull in
// AchievementsController and, with it, a JwtAuthGuard dependency that has no place in the
// background-job process (worker.module.ts) ScoringModule now runs in. The REST controller
// lives in AchievementsApiModule, imported only by AppModule.
@Module({
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
