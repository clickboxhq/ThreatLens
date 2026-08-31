import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { CohortAccessService } from './cohort-access.service';

@Module({
  controllers: [InstructorController],
  providers: [InstructorService, CohortAccessService],
  exports: [InstructorService],
})
export class InstructorModule {}
