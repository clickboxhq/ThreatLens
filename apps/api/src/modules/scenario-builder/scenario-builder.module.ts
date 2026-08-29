import { Module } from '@nestjs/common';
import { ScenarioBuilderController } from './scenario-builder.controller';
import { ScenarioBuilderService } from './scenario-builder.service';

@Module({
  controllers: [ScenarioBuilderController],
  providers: [ScenarioBuilderService],
})
export class ScenarioBuilderModule {}
