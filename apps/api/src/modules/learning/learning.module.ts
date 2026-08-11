import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { CertificateVerificationController } from './certificate-verification.controller';
import { LearningService } from './learning.service';
import { CertificatesModule } from './certificates.module';

@Module({
  imports: [CertificatesModule],
  controllers: [LearningController, CertificateVerificationController],
  providers: [LearningService],
})
export class LearningModule {}
