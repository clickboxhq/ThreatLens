import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as client from 'prom-client';
import {
  TELEMETRY_GENERATION_QUEUE,
  ALERT_CORRELATION_QUEUE,
  SCORING_QUEUE,
} from '../queue/queue.module';

// Golden signals (§3.10): latency+traffic+errors via the HTTP histogram/counter below
// (populated by MetricsInterceptor), saturation via prom-client's default Node process
// metrics plus the BullMQ queue-depth gauge (a stuck worker pool is a direct product-quality
// incident here, since it delays scenario start — §3.10 names this explicitly).
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new client.Registry();

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  constructor(
    @InjectQueue(TELEMETRY_GENERATION_QUEUE)
    private readonly telemetryQueue: Queue,
    @InjectQueue(ALERT_CORRELATION_QUEUE)
    private readonly alertQueue: Queue,
    @InjectQueue(SCORING_QUEUE)
    private readonly scoringQueue: Queue,
  ) {}

  onModuleInit(): void {
    client.collectDefaultMetrics({ register: this.registry });

    const queues: Array<[string, Queue]> = [
      [TELEMETRY_GENERATION_QUEUE, this.telemetryQueue],
      [ALERT_CORRELATION_QUEUE, this.alertQueue],
      [SCORING_QUEUE, this.scoringQueue],
    ];

    // Async `collect()` runs once per /metrics scrape, so queue depth is always read fresh
    // from Redis rather than polled on a separate timer — no drift between what Prometheus
    // sees and what BullMQ actually holds at scrape time.
    new client.Gauge({
      name: 'bullmq_jobs',
      help: 'BullMQ job counts by queue and state',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
      async collect() {
        for (const [name, queue] of queues) {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
          );
          for (const [state, count] of Object.entries(counts)) {
            this.set({ queue: name, state }, count);
          }
        }
      },
    });
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
