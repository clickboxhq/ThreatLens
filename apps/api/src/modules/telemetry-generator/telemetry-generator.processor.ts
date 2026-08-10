import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  ALERT_CORRELATION_QUEUE,
  TELEMETRY_GENERATION_QUEUE,
} from '../../common/queue/queue.module';
import { TelemetryGeneratorService } from './telemetry-generator.service';

export interface TelemetryGenerationJobData {
  sessionId: string;
}

// §5.9: telemetry-generation queue. Chains into alert-correlation on completion (§8.4).
@Processor(TELEMETRY_GENERATION_QUEUE)
export class TelemetryGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(TelemetryGeneratorProcessor.name);

  constructor(
    private readonly telemetryGeneratorService: TelemetryGeneratorService,
    @InjectQueue(ALERT_CORRELATION_QUEUE)
    private readonly alertCorrelationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<TelemetryGenerationJobData>): Promise<void> {
    const { sessionId } = job.data;
    this.logger.log(
      `Generating telemetry for session ${sessionId} (job ${job.id})`,
    );
    await this.telemetryGeneratorService.generateForSession(sessionId);
    await this.alertCorrelationQueue.add(
      'correlate',
      { sessionId },
      { jobId: `alert-correlation-${sessionId}` },
    );
  }
}
