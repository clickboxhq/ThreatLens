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
import { TelemetryGeneratorModule } from './modules/telemetry-generator/telemetry-generator.module';
import { AlertEngineModule } from './modules/alert-engine/alert-engine.module';
import { ScenarioCatalogModule } from './modules/scenario-catalog/scenario-catalog.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { InvestigationModule } from './modules/investigation/investigation.module';
import { IdentityPortalModule } from './modules/identity-portal/identity-portal.module';
import { DevicePortalModule } from './modules/device-portal/device-portal.module';
import { EmailPortalModule } from './modules/email-portal/email-portal.module';
import { ThreatIntelModule } from './modules/threat-intel/threat-intel.module';
import { SearchModule } from './modules/search/search.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { MitreModule } from './modules/mitre/mitre.module';
import { CohortsModule } from './modules/cohorts/cohorts.module';
import { InstructorModule } from './modules/instructor/instructor.module';
import { HintsModule } from './modules/hints/hints.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { RealtimeModule } from './common/realtime/realtime.module';

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
    TelemetryGeneratorModule,
    AlertEngineModule,
    ScenarioCatalogModule,
    SessionsModule,
    InvestigationModule,
    IdentityPortalModule,
    DevicePortalModule,
    EmailPortalModule,
    ThreatIntelModule,
    SearchModule,
    ScoringModule,
    MitreModule,
    CohortsModule,
    InstructorModule,
    HintsModule,
    LeaderboardModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
