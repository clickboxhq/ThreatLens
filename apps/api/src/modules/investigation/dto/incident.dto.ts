import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

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

// The 6 options ThreatLens's "Response actions" panel offers. That panel is a flat button
// list with no entity picker (verified against the frontend: it logs { actionId, label, target }
// with `target` just a category string like "device", never a specific device/identity/email
// id) — so unlike POST .../devices/:id/isolate (which really flips a specific device's state),
// this is a generic "log that this category of response action was taken on this incident"
// endpoint. Real per-entity mutation stays on the dedicated portal endpoints for whichever
// action already has one (isolate_device); the rest audit-only until/unless a target-entity
// picker exists to drive a real per-entity effect.
const RESPONSE_ACTION_TYPES = [
  'isolate_device',
  'disable_account',
  'force_password_reset',
  'revoke_tokens',
  'block_sender',
  'block_ip',
] as const;

export class LogResponseActionDto {
  @IsIn(RESPONSE_ACTION_TYPES)
  actionType!: (typeof RESPONSE_ACTION_TYPES)[number];

  @IsString()
  @MinLength(1)
  targetType!: string;
}

export class SetTaskCompletionDto {
  @IsBoolean()
  completed!: boolean;
}
