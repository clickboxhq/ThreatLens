import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsModule } from './achievements.module';

// REST-facing half of the split (see AchievementsModule's own comment) — imported only by
// AppModule, never by ScoringModule/WorkerModule.
@Module({
  imports: [AchievementsModule],
  controllers: [AchievementsController],
})
export class AchievementsApiModule {}
