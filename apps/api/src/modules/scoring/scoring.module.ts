import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringProcessor } from './scoring.processor';
import { CertificatesModule } from '../learning/certificates.module';

@Module({
  imports: [CertificatesModule],
  providers: [ScoringService, ScoringProcessor],
  exports: [ScoringService],
})
export class ScoringModule {}
