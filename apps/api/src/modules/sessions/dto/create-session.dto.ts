import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  scenarioId!: string;

  @IsOptional()
  @IsString()
  cohortAssignmentId?: string;
}
