import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InstructorService } from './instructor.service';
import { CohortStaffService } from './cohort-staff.service';
import { CohortInviteService } from './cohort-invite.service';
import {
  AddCohortStaffDto,
  AssignGroupTutorDto,
  CreateAssignmentDto,
  CreateCohortDto,
  CreateCohortGroupDto,
  PlaceStudentInGroupDto,
  SubmitInstructorFeedbackDto,
  UpdateCohortStaffRoleDto,
  CreateCohortInviteDto,
} from './dto/instructor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.13 — Instructor Service. Every route here is coarse-gated by role (§15.2 layer 1);
// which cohort, and with what authority, is decided in the service (§15.2 layer 2), since an
// instructor is staffed on some cohorts and not others.
//
// org_admin is admitted at this coarse layer so they can read cohorts in their organisation.
// CohortAccessService refuses them every write, so the guard staying permissive here does not
// widen what they can actually do.
@Controller('instructor')
@UseGuards(JwtAuthGuard, RolesGuard)
// Coarse gate only. org_admin and platform_admin are admitted here so they can reach a
// cohort at all; CohortAccessService decides what each may actually do with it — an
// org_admin reads their organisation's cohorts, a platform_admin reads any cohort and may
// repair its staffing, and neither may teach.
@Roles('instructor', 'org_admin', 'platform_admin')
export class InstructorController {
  constructor(
    private readonly instructorService: InstructorService,
    private readonly cohortStaff: CohortStaffService,
    private readonly cohortInvites: CohortInviteService,
  ) {}

  // ---------------------------------------------------------------- staff

  @Get('cohorts/:id/staff')
  async listStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cohortStaff.listStaff(user, id);
  }

  @Post('cohorts/:id/staff')
  async addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCohortStaffDto,
  ) {
    return this.cohortStaff.addStaff(user, id, dto.email, dto.role);
  }

  @Patch('cohorts/:id/staff/:userId')
  async updateStaffRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateCohortStaffRoleDto,
  ) {
    return this.cohortStaff.updateStaffRole(user, id, userId, dto.role);
  }

  @Delete('cohorts/:id/staff/:userId')
  async removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.cohortStaff.removeStaff(user, id, userId);
  }

  // ---------------------------------------------------------------- groups

  // Invitations. A cohort has a join code as well, but a code cannot be addressed to one
  // person, withdrawn from them, or expire on its own.
  @Get('cohorts/:id/invites')
  async listInvites(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) cohortId: string,
  ) {
    return this.cohortInvites.list(user, cohortId);
  }

  @Post('cohorts/:id/invites')
  async createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) cohortId: string,
    @Body() dto: CreateCohortInviteDto,
  ) {
    return this.cohortInvites.create(user, cohortId, dto.email, dto.groupId);
  }

  @Delete('cohorts/:id/invites/:inviteId')
  async revokeInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) cohortId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.cohortInvites.revoke(user, cohortId, inviteId);
  }

  @Get('cohorts/:id/groups')
  async listGroups(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cohortStaff.listGroups(user, id);
  }

  @Post('cohorts/:id/groups')
  async createGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCohortGroupDto,
  ) {
    return this.cohortStaff.createGroup(user, id, dto.name);
  }

  @Delete('cohorts/:id/groups/:groupId')
  async deleteGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.cohortStaff.deleteGroup(user, id, groupId);
  }

  @Post('cohorts/:id/groups/:groupId/tutors')
  async assignGroupTutor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: AssignGroupTutorDto,
  ) {
    return this.cohortStaff.assignGroupTutor(user, id, groupId, dto.userId);
  }

  @Delete('cohorts/:id/groups/:groupId/tutors/:userId')
  async removeGroupTutor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.cohortStaff.removeGroupTutor(user, id, groupId, userId);
  }

  @Patch('cohorts/:id/students/:userId/group')
  async placeStudentInGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PlaceStudentInGroupDto,
  ) {
    return this.cohortStaff.placeStudentInGroup(
      user,
      id,
      userId,
      dto.groupId ?? null,
    );
  }

  @Post('cohorts')
  async createCohort(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCohortDto,
  ) {
    return this.instructorService.createCohort(user, dto);
  }

  @Get('cohorts')
  async listCohorts(@CurrentUser() user: AuthenticatedUser) {
    return this.instructorService.listCohorts(user);
  }

  @Get('cohorts/:id/roster')
  async getRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instructorService.getRoster(user, id);
  }

  @Post('cohorts/:id/assignments')
  async createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.instructorService.createAssignment(user, id, dto);
  }

  @Get('cohorts/:id/assignments')
  async listAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instructorService.listAssignments(user, id);
  }

  @Get('cohorts/:id/review-queue')
  async reviewQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.instructorService.reviewQueue(user, id);
  }

  @Post('incidents/:id/feedback')
  async submitFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitInstructorFeedbackDto,
  ) {
    return this.instructorService.submitFeedback(user, id, dto);
  }

  @Get('cohorts/:id/gradebook.csv')
  async gradebookCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const csv = await this.instructorService.gradebookCsv(user, id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gradebook-${id}.csv"`,
    );
    res.send(csv);
  }
}
