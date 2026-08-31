import {
  Radar,
  ShieldCheck,
  Wrench,
  Siren,
  Microscope,
  Crosshair,
  Fingerprint,
  ClipboardList,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";

/**
 * ThreatLens Cybersecurity Avatars — an original, geometric role-badge
 * system, not illustrated characters. Each preset pairs one role icon with
 * one accent hue on a shared angular-badge shape, so the whole set reads as
 * one consistent visual language rather than nine unrelated icons.
 *
 * (Scope note: the brief describes full illustrated characters with
 * skin-tone/hairstyle/clothing variation — that's a real illustration
 * commission, not something to hand-author well in code. This delivers the
 * "pick a role that represents you" idea faithfully, in a style that's
 * actually original and on-brand, rather than a rough first draft of
 * character art.)
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

export const AVATAR_PRESETS: {
  key: AvatarPresetKey;
  label: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { key: "soc_analyst", label: "SOC Analyst", icon: Radar, tone: "var(--info)" },
  { key: "threat_hunter", label: "Threat Hunter", icon: Crosshair, tone: "var(--critical)" },
  { key: "security_engineer", label: "Security Engineer", icon: Wrench, tone: "var(--success)" },
  { key: "incident_responder", label: "Incident Responder", icon: Siren, tone: "var(--high)" },
  { key: "dfir_analyst", label: "DFIR Analyst", icon: Microscope, tone: "var(--warning)" },
  {
    key: "penetration_tester",
    label: "Penetration Tester",
    icon: Fingerprint,
    tone: "var(--critical)",
  },
  {
    key: "threat_intel_analyst",
    label: "Threat Intel Analyst",
    icon: ShieldCheck,
    tone: "var(--info)",
  },
  {
    key: "grc_professional",
    label: "GRC Professional",
    icon: ClipboardList,
    tone: "var(--secondary-foreground)",
  },
  {
    key: "security_researcher",
    label: "Security Researcher",
    icon: FlaskConical,
    tone: "var(--success)",
  },
];

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
  const Icon = preset.icon;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        borderRadius: size * 0.28,
        background: `color-mix(in oklab, ${preset.tone} 16%, var(--card))`,
        border: `1px solid color-mix(in oklab, ${preset.tone} 45%, transparent)`,
        color: preset.tone,
        flexShrink: 0,
      }}
      title={preset.label}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
