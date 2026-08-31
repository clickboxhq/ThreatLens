import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCohortDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class CreateAssignmentDto {
  @IsUUID()
  scenarioId!: string;

  /** Omitted means the whole cohort; set targets one group. */
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attemptLimit?: number;
}

export class SubmitInstructorFeedbackDto {
  @IsOptional()
  @IsObject()
  rubricOverrides?: Record<string, number>;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  reopenSession?: boolean;
}

// ---------- Cohort staffing and groups ----------

export class AddCohortStaffDto {
  /** Identified by email so a lead can staff a colleague without looking up their user id. */
  @IsEmail()
  email!: string;

  @IsIn(['lead', 'tutor', 'group_tutor'])
  role!: 'lead' | 'tutor' | 'group_tutor';
}

export class UpdateCohortStaffRoleDto {
  @IsIn(['lead', 'tutor', 'group_tutor'])
  role!: 'lead' | 'tutor' | 'group_tutor';
}

export class CreateCohortGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

export class AssignGroupTutorDto {
  @IsUUID()
  userId!: string;
}

export class PlaceStudentInGroupDto {
  /** Null removes them from their current group without unenrolling them. */
  @IsOptional()
  @IsUUID()
  groupId?: string | null;
}
