import { Module } from '@nestjs/common';
import { CareerProgressionController } from './career-progression.controller';
import { CareerProgressionModule } from './career-progression.module';

// REST-facing half of the split — imported only by AppModule, never by ScoringModule/WorkerModule.
@Module({
  imports: [CareerProgressionModule],
  controllers: [CareerProgressionController],
})
export class CareerProgressionApiModule {}
