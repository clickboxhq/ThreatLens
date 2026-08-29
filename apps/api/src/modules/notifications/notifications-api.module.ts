import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

// REST-facing half of the split (see NotificationsModule's own comment) — imported only by
// AppModule, never by WorkerModule. NotificationsService itself is available here already
// since NotificationsModule is @Global(), so this module needs no imports of its own.
@Module({
  controllers: [NotificationsController],
})
export class NotificationsApiModule {}
