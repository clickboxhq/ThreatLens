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

// The 6 options ThreatLens's "Response actions" panel offers. Exported because the Scoring
// Engine (§12.4) and the scenario validator both need the same list: a rubric's
// containment_expectations may only name actions a student can actually take.
export const RESPONSE_ACTION_TYPES = [
  'isolate_device',
  'disable_account',
  'force_password_reset',
  'revoke_tokens',
  'block_sender',
  'block_ip',
] as const;
export type ResponseActionType = (typeof RESPONSE_ACTION_TYPES)[number];

// `targetId` is the specific identity/device the action was taken against, and is what the
// Scoring Engine matches a containment expectation on — "disable the account" means *that*
// account, not any account. Optional for one release only: the api deploys ~60s before the web
// (ci.yml), and the current panel does not send it yet. An action logged without a target is
// recorded against the incident and never satisfies a targeted expectation. Make it required
// once the web ships its entity picker. isolate_device has its own real endpoint
// (POST .../devices/:id/isolate) that flips device state and records the action with the
// device id — the web should call that, not this.
export class LogResponseActionDto {
  @IsIn(RESPONSE_ACTION_TYPES)
  actionType!: ResponseActionType;

  @IsString()
  @MinLength(1)
  targetType!: string;

  @IsOptional()
  @IsUUID()
  targetId?: string;
}

export class SetTaskCompletionDto {
  @IsBoolean()
  completed!: boolean;
}
