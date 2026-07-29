import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCORING_QUEUE } from '../../common/queue/queue.module';
import { ScoringService } from './scoring.service';
import type { ScoringJobData } from './scoring.types';

export type { ScoringJobData } from './scoring.types';

@Processor(SCORING_QUEUE)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(private readonly scoringService: ScoringService) {
    super();
  }

  async process(job: Job<ScoringJobData>): Promise<void> {
    const { sessionId } = job.data;
    this.logger.log(`Scoring session ${sessionId} (job ${job.id})`);
    await this.scoringService.scoreSession(sessionId);
  }
}
