import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { CohortAccessService } from './cohort-access.service';
import { CohortStaffService } from './cohort-staff.service';
import { CohortInviteService } from './cohort-invite.service';
import { CohortInvitePublicController } from './cohort-invite-public.controller';
// EmailService is not global — AuthModule and OrganizationsModule each provide their own.
// CohortInviteService needs one too, and without it Nest cannot build this module at all.
import { EmailService } from '../../common/email/email.service';

@Module({
  controllers: [InstructorController, CohortInvitePublicController],
  providers: [
    InstructorService,
    CohortAccessService,
    CohortStaffService,
    CohortInviteService,
    EmailService,
  ],
  exports: [InstructorService],
})
export class InstructorModule {}
