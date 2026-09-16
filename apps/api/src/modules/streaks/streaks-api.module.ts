import { Module } from '@nestjs/common';
import { StreaksController } from './streaks.controller';
import { StreaksModule } from './streaks.module';

// REST-facing half of the split (see StreaksModule's own comment) — imported only by
// AppModule, never by SessionsModule/WorkerModule.
@Module({
  imports: [StreaksModule],
  controllers: [StreaksController],
})
export class StreaksApiModule {}
