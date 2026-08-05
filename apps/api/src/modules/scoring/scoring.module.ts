import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';
import { LearningModule } from '../learning/learning.module';

@Module({
  imports: [LearningModule],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
