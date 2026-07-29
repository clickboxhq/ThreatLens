import { Module } from '@nestjs/common';
import { TelemetryGeneratorService } from './telemetry-generator.service';
import { TelemetryGeneratorProcessor } from './telemetry-generator.processor';

@Module({
  providers: [TelemetryGeneratorService, TelemetryGeneratorProcessor],
  exports: [TelemetryGeneratorService],
})
export class TelemetryGeneratorModule {}
