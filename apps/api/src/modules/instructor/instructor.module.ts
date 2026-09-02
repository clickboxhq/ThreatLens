import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { CohortAccessService } from './cohort-access.service';
import { CohortStaffService } from './cohort-staff.service';

@Module({
  controllers: [InstructorController],
  providers: [InstructorService, CohortAccessService, CohortStaffService],
  exports: [InstructorService],
})
export class InstructorModule {}
