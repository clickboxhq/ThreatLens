import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { CohortAccessService } from './cohort-access.service';
import { CohortStaffService } from './cohort-staff.service';
import { CohortInviteService } from './cohort-invite.service';
import { CohortInvitePublicController } from './cohort-invite-public.controller';

@Module({
  controllers: [InstructorController, CohortInvitePublicController],
  providers: [
    InstructorService,
    CohortAccessService,
    CohortStaffService,
    CohortInviteService,
  ],
  exports: [InstructorService],
})
export class InstructorModule {}
