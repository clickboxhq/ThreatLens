import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';

// Exported (not @Global) — only the platform-admin analytics surface consumes it today. A
// future real billing page / webhook controller would be added here.
@Module({
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
