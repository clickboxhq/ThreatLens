import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

// §2.18/§16.15: deliberately unauthenticated — a certificate's whole purpose is to be
// verifiable by a third party (an employer, another platform) who has no SOCVerse account.
@Controller('learning/public')
export class CertificateVerificationController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('verify/:id')
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificatesService.verify(id);
  }
}
