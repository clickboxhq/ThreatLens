import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InstructorService } from './instructor.service';
import {
  CreateAssignmentDto,
  CreateCohortDto,
  SubmitInstructorFeedbackDto,
} from './dto/instructor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// §16.13 — Instructor Service. Every route here is coarse-gated to the `instructor`
// role (§15.2 layer 1); fine-grained cohort-ownership checks happen in the service
// (§15.2 layer 2), since an instructor may own some cohorts but not others.
@Controller('instructor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor')
export class InstructorController {
  constructor(private readonly instructorService: InstructorService) {}

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
