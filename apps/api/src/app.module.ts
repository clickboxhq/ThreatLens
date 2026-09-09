import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './common/health/health.controller';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaModule } from './prisma/prisma.module';
import { JwtSharedModule } from './common/jwt-shared.module';
import { QueueModule } from './common/queue/queue.module';
import { SessionCoreModule } from './modules/session-core/session-core.module';
import { AuthModule } from './modules/auth/auth.module';
import { ScenarioCatalogModule } from './modules/scenario-catalog/scenario-catalog.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { InvestigationModule } from './modules/investigation/investigation.module';
import { IdentityPortalModule } from './modules/identity-portal/identity-portal.module';
import { DevicePortalModule } from './modules/device-portal/device-portal.module';
import { EmailPortalModule } from './modules/email-portal/email-portal.module';
import { NetworkPortalModule } from './modules/network-portal/network-portal.module';
import { ThreatIntelModule } from './modules/threat-intel/threat-intel.module';
import { SearchModule } from './modules/search/search.module';
import { MitreModule } from './modules/mitre/mitre.module';
import { CohortsModule } from './modules/cohorts/cohorts.module';
import { InstructorModule } from './modules/instructor/instructor.module';
import { HintsModule } from './modules/hints/hints.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { LearningModule } from './modules/learning/learning.module';
import { AuditLogModule } from './common/audit-log/audit-log.module';
import { RateLimiterModule } from './common/rate-limiter/rate-limiter.module';
import { AdminModule } from './modules/admin/admin.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AchievementsApiModule } from './modules/achievements/achievements-api.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationsApiModule } from './modules/notifications/notifications-api.module';
import { ScenarioBuilderModule } from './modules/scenario-builder/scenario-builder.module';
import { ProfileModule } from './modules/profile/profile.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlatformSettingsModule } from './modules/admin/platform-settings/platform-settings.module';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
    }),
    PrismaModule,
    JwtSharedModule,
    QueueModule,
    SessionCoreModule,
    AuthModule,
    ScenarioCatalogModule,
    SessionsModule,
    InvestigationModule,
    IdentityPortalModule,
    DevicePortalModule,
    EmailPortalModule,
    NetworkPortalModule,
    ThreatIntelModule,
    SearchModule,
    MitreModule,
    CohortsModule,
    InstructorModule,
    HintsModule,
    LeaderboardModule,
    RealtimeModule,
    LearningModule,
    AuditLogModule,
    RateLimiterModule,
    AdminModule,
    MetricsModule,
    OrganizationsModule,
    AchievementsApiModule,
    NotificationsModule,
    NotificationsApiModule,
    ScenarioBuilderModule,
    ProfileModule,
    BillingModule,
    PlatformSettingsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, MaintenanceMiddleware)
      .forRoutes('*');
  }
}
