import { IsArray, IsUUID } from 'class-validator';

export class SubmitSessionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  incidentIds!: string[];
}
