import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './common/health/health.controller';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './common/queue/queue.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { TelemetryGeneratorModule } from './modules/telemetry-generator/telemetry-generator.module';
import { AlertEngineModule } from './modules/alert-engine/alert-engine.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { MetricsModule } from './common/metrics/metrics.module';

// §19.1: the background-job counterpart to AppModule, bootstrapped separately via
// worker-main.ts. Deliberately excludes every REST-facing module (auth, all the
// investigation portals, instructor mode, etc.) — nothing here is reachable except via
// BullMQ (§5.9) and Redis pub/sub (RealtimeEventsService), which is exactly how the
// telemetry generator / alert engine / scoring engine already communicated with the rest of
// the app even before the process split (SessionsService only ever injects the Queue objects
// to enqueue jobs, never these modules' services directly — confirmed before this refactor).
// Keeps HealthController + MetricsModule so this process has the same operational surface
// (health check, Prometheus scrape target) as `app`, on its own port.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
    }),
    PrismaModule,
    QueueModule,
    RealtimeModule,
    TelemetryGeneratorModule,
    AlertEngineModule,
    ScoringModule,
    MetricsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class WorkerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
