import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { CertificateVerificationController } from './certificate-verification.controller';
import { LearningService } from './learning.service';
import { CertificatesService } from './certificates.service';

@Module({
  controllers: [LearningController, CertificateVerificationController],
  providers: [LearningService, CertificatesService],
  exports: [CertificatesService],
})
export class LearningModule {}
