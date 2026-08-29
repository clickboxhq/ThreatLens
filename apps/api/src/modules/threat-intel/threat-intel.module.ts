import { Module } from '@nestjs/common';
import {
  ThreatIntelController,
  ThreatIntelHistoryController,
} from './threat-intel.controller';
import { ThreatIntelService } from './threat-intel.service';

@Module({
  controllers: [ThreatIntelController, ThreatIntelHistoryController],
  providers: [ThreatIntelService],
})
export class ThreatIntelModule {}
