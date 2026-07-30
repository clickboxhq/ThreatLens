import { Module } from '@nestjs/common';
import { MitreController } from './mitre.controller';

@Module({
  controllers: [MitreController],
})
export class MitreModule {}
