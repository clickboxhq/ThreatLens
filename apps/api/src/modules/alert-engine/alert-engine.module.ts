import { Module } from '@nestjs/common';
import { AlertEngineService } from './alert-engine.service';
import { AlertEngineProcessor } from './alert-engine.processor';

@Module({
  providers: [AlertEngineService, AlertEngineProcessor],
  exports: [AlertEngineService],
})
export class AlertEngineModule {}
