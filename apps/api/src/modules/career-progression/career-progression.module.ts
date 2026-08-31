import { Module } from '@nestjs/common';
import { CareerProgressionService } from './career-progression.service';

// Service-only, same split as AchievementsModule/CertificatesModule — see that module's own
// comment. ScoringModule imports this one; CareerProgressionApiModule (REST) is imported only
// by AppModule.
@Module({
  providers: [CareerProgressionService],
  exports: [CareerProgressionService],
})
export class CareerProgressionModule {}
