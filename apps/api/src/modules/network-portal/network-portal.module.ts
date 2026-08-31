import { Module } from '@nestjs/common';
import { NetworkPortalController } from './network-portal.controller';
import { NetworkPortalService } from './network-portal.service';

@Module({
  controllers: [NetworkPortalController],
  providers: [NetworkPortalService],
})
export class NetworkPortalModule {}
