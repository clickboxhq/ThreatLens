import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { ScrubbingLogger } from './common/logging/scrubbing-logger.service';

// §19.1: background-job process — BullMQ workers for telemetry generation, alert
// correlation, and scoring (§5.9) start the moment WorkerModule's providers are
// instantiated, same as they always did inside AppModule pre-split. This entrypoint's only
// HTTP surface is /health, /ready, /metrics (worker.module.ts) — no REST API, no CORS, no
// WebSocket gateway (RealtimeEventsService publishes to Redis pub/sub instead, so it needs
// no gateway attached in this process — see worker.module.ts's comment).
async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    logger: new ScrubbingLogger(),
  });

  const port = process.env.WORKER_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
