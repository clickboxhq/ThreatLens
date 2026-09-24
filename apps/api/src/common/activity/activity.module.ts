import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityTrackingService } from './activity-tracking.service';
import { ActivityInterceptor } from './activity.interceptor';

// @Global() so ActivityTrackingService can be injected directly (e.g. by CertificatesService,
// for the worker-triggered completion case the HTTP interceptor can't reach) without every
// consuming module importing this one — same convention as AuditLogModule/NotificationsModule.
@Global()
@Module({
  providers: [
    ActivityTrackingService,
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
  exports: [ActivityTrackingService],
})
export class ActivityModule {}
