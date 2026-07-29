import { Module } from '@nestjs/common';
import { ScenarioCatalogController } from './scenario-catalog.controller';

@Module({
  controllers: [ScenarioCatalogController],
})
export class ScenarioCatalogModule {}
