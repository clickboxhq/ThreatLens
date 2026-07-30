import { IsString, MinLength } from 'class-validator';

export class JoinCohortDto {
  @IsString()
  @MinLength(1)
  joinCode!: string;
}
