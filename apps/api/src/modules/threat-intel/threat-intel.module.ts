import { Module } from '@nestjs/common';
import { ThreatIntelController } from './threat-intel.controller';

@Module({
  controllers: [ThreatIntelController],
})
export class ThreatIntelModule {}
