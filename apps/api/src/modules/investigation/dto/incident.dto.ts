import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @MinLength(1)
  title!: string;
}

export class LinkAlertsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayNotEmpty()
  alertIds!: string[];
}

export class UpdateIncidentStatusDto {
  @IsIn(['open', 'investigating', 'contained', 'closed', 'reopened'])
  status!: 'open' | 'investigating' | 'contained' | 'closed' | 'reopened';
}

export class CloseIncidentDto {
  @IsIn(['true_positive', 'false_positive', 'benign_positive'])
  verdict!: 'true_positive' | 'false_positive' | 'benign_positive';

  @IsString()
  @MinLength(20)
  summary!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  mitreTechniqueIds!: string[];
}

export class PinEvidenceDto {
  @IsString()
  eventTable!: string;

  @IsUUID()
  eventId!: string;

  @IsString()
  @MinLength(5)
  justification!: string;

  @IsOptional()
  @IsUUID()
  mitreTechniqueId?: string;
}

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

export class AddToTimelineDto {
  @IsString()
  eventTable!: string;

  @IsUUID()
  eventId!: string;
}
