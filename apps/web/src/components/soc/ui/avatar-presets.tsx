/**
 * ThreatLens role avatars — a set of nine rendered character portraits, one
 * per security role, that a user can pick instead of uploading a photo.
 *
 * The image files live in `public/avatars/<key>.webp` and are named by the
 * same keys stored on `User.avatarPresetKey`, so a stored selection maps
 * straight to a file with no lookup table. The key list is mirrored (by hand
 * — small, stable) in the API's `set-avatar-preset.dto.ts`.
 */
export type AvatarPresetKey =
  | "soc_analyst"
  | "threat_hunter"
  | "security_engineer"
  | "incident_responder"
  | "dfir_analyst"
  | "penetration_tester"
  | "threat_intel_analyst"
  | "grc_professional"
  | "security_researcher";

export const AVATAR_PRESETS: { key: AvatarPresetKey; label: string }[] = [
  { key: "soc_analyst", label: "SOC Analyst" },
  { key: "threat_hunter", label: "Threat Hunter" },
  { key: "security_engineer", label: "Security Engineer" },
  { key: "incident_responder", label: "Incident Responder" },
  { key: "dfir_analyst", label: "DFIR Analyst" },
  { key: "penetration_tester", label: "Penetration Tester" },
  { key: "threat_intel_analyst", label: "Threat Intel Analyst" },
  { key: "grc_professional", label: "GRC Professional" },
  { key: "security_researcher", label: "Security Researcher" },
];

/** Public path to a preset's portrait. Safe to call with an unknown key. */
export function avatarPresetSrc(key: string): string {
  return `/avatars/${key}.webp`;
}

export function avatarPreset(key?: string | null) {
  return AVATAR_PRESETS.find((p) => p.key === key);
}

export function AvatarPresetBadge({
  presetKey,
  size = 40,
  className,
}: {
  presetKey: string;
  size?: number;
  className?: string;
}) {
  const preset = avatarPreset(presetKey);
  if (!preset) return null;
  return (
    <img
      src={avatarPresetSrc(preset.key)}
      alt={preset.label}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        display: "block",
      }}
      title={preset.label}
      draggable={false}
    />
  );
}
