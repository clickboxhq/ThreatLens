import { Global, Module } from '@nestjs/common';
import { RealtimeEventsService } from './realtime-events.service';

// Global, like QueueModule/JwtSharedModule — every feature module that mutates
// alerts/incidents needs to publish a realtime event (§5.10), so this avoids
// re-importing the module everywhere.
@Global()
@Module({
  providers: [RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
