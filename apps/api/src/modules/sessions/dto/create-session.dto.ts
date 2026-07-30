import { IsOptional, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsUUID()
  scenarioId!: string;

  @IsOptional()
  @IsUUID()
  cohortAssignmentId?: string;
}
