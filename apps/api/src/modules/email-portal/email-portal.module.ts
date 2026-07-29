import { Module } from '@nestjs/common';
import { EmailPortalController } from './email-portal.controller';
import { EmailPortalService } from './email-portal.service';

@Module({
  controllers: [EmailPortalController],
  providers: [EmailPortalService],
})
export class EmailPortalModule {}
