import { Module } from '@nestjs/common';
import { IdentityPortalController } from './identity-portal.controller';
import { IdentityPortalService } from './identity-portal.service';

@Module({
  controllers: [IdentityPortalController],
  providers: [IdentityPortalService],
})
export class IdentityPortalModule {}
