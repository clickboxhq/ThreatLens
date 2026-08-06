import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

// Global for the same reason as SessionCoreModule: used by unrelated modules (auth,
// investigation, instructor) that shouldn't depend on each other just to share this.
@Global()
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
