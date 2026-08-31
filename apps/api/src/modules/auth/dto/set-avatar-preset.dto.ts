import { IsIn, IsOptional } from 'class-validator';

// Mirrors the geometric role-badge set on the frontend (avatar-presets.tsx).
// Kept in sync by hand rather than shared across packages — small, stable list.
export const AVATAR_PRESET_KEYS = [
  'soc_analyst',
  'threat_hunter',
  'security_engineer',
  'incident_responder',
  'dfir_analyst',
  'penetration_tester',
  'threat_intel_analyst',
  'grc_professional',
  'security_researcher',
] as const;

export class SetAvatarPresetDto {
  // Omitted/null presetKey means "use initials" — see AuthService.setAvatarPreset.
  @IsOptional()
  @IsIn(AVATAR_PRESET_KEYS)
  presetKey?: (typeof AVATAR_PRESET_KEYS)[number];
}
