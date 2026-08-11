import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

// Split out of LearningModule so a consumer that only needs certificate issuance/lookup
// (ScoringModule, on session scoring) doesn't also pull in LearningModule's REST controllers
// — and with them, a JwtAuthGuard dependency that has no place in the background-job process
// (worker.module.ts) ScoringModule now runs in.
@Module({
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
