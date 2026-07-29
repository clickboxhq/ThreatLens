import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';

@Module({
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
