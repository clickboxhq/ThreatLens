import { Module } from '@nestjs/common';
import { DevicePortalController } from './device-portal.controller';
import { DevicePortalService } from './device-portal.service';

@Module({
  controllers: [DevicePortalController],
  providers: [DevicePortalService],
})
export class DevicePortalModule {}
