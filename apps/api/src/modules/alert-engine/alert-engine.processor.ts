import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ALERT_CORRELATION_QUEUE } from '../../common/queue/queue.module';
import { AlertEngineService } from './alert-engine.service';

export interface AlertCorrelationJobData {
  sessionId: string;
}

@Processor(ALERT_CORRELATION_QUEUE)
export class AlertEngineProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertEngineProcessor.name);

  constructor(private readonly alertEngineService: AlertEngineService) {
    super();
  }

  async process(job: Job<AlertCorrelationJobData>): Promise<void> {
    const { sessionId } = job.data;
    this.logger.log(`Evaluating alerts for session ${sessionId} (job ${job.id})`);
    await this.alertEngineService.evaluateForSession(sessionId);
  }
}
