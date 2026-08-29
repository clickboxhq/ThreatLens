import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Global for the same reason as AuditLogModule: consumed by modules on both sides of the
// api/worker process split (ScoringModule + CertificatesModule run in the worker;
// InstructorModule + OrganizationsModule are api-only) that shouldn't have to depend on each
// other just to share this. Service-only, same split as AchievementsModule/CertificatesModule
// — the REST controller lives in NotificationsApiModule, imported only by AppModule, so
// JwtAuthGuard's JwtService dependency never ends up in the worker's DI graph.
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
