import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Redis-backed job queue broker, shared by every worker (§5.9).
export const TELEMETRY_GENERATION_QUEUE = 'telemetry-generation';
export const ALERT_CORRELATION_QUEUE = 'alert-correlation';
export const SCORING_QUEUE = 'scoring';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue(
      { name: TELEMETRY_GENERATION_QUEUE },
      { name: ALERT_CORRELATION_QUEUE },
      { name: SCORING_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
