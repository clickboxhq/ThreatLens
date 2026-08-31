import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';
import { CertificatesModule } from '../learning/certificates.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { CareerProgressionModule } from '../career-progression/career-progression.module';

@Module({
  imports: [CertificatesModule, AchievementsModule, CareerProgressionModule],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
