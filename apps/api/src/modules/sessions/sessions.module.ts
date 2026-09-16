import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { StreaksModule } from '../streaks/streaks.module';

@Module({
  imports: [StreaksModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
