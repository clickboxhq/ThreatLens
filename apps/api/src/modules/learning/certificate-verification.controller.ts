import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

// §2.18/§16.15: deliberately unauthenticated — a certificate's whole purpose is to be
// verifiable by a third party (an employer, another platform) who has no ThreatLens account.
// Accepts the public id (TL-YYYY-XXXXXXXX) or, for links shared before public ids existed,
// the raw certificate uuid. An unknown value gets a plain 404 (handled by the service) — no
// database errors, ids or internals leak.
@Controller('learning/public')
export class CertificateVerificationController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('verify/:id')
  async verify(@Param('id') id: string) {
    return this.certificatesService.verify(id);
  }
}
