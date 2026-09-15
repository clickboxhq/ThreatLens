import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class AddOrganizationScenariosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  scenarioIds!: string[];
}

export class UpdateOrganizationScenarioDueDateDto {
  // This endpoint exists only to set/clear the due date, so the field is always required —
  // a literal `null` clears it (§Task 5's "clear the due date"), anything else must be a real
  // ISO 8601 date the server can validate, never trusting an opaque client-formatted string.
  @ValidateIf((o: UpdateOrganizationScenarioDueDateDto) => o.dueAt !== null)
  @IsISO8601()
  dueAt!: string | null;
}
