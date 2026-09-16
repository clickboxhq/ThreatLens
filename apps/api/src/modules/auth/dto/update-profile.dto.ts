import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// IANA zone names top out well under this (the longest, "America/Argentina/ComodRivadavia",
// is 33 chars) — generous ceiling rather than an exact enum, since the set changes over time.
const TIMEZONE_MAX_LENGTH = 64;

const EXPERIENCE_LEVELS = [
  'new_to_security',
  'early_career',
  'experienced',
  'career_switcher',
] as const;

// Every field optional and independently updatable — PATCH semantics, not
// a full-replace PUT. displayName is intentionally not editable here: it's
// shown across the app (topbar, leaderboard, notifications) and changing
// it is a bigger, separate concern than the profile fields this covers.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  professionalRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  careerGoal?: string;

  @IsOptional()
  @IsIn(EXPERIENCE_LEVELS)
  experienceLevel?: (typeof EXPERIENCE_LEVELS)[number];

  /** IANA zone name, captured client-side from Intl — see app-shell.tsx. Not user-facing form
   * input, so no format enum, just a length ceiling. */
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  timezone?: string;
}
