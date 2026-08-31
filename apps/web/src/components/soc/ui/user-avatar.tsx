import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/auth-store";
import { AvatarPresetBadge } from "@/components/soc/ui/avatar-presets";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Renders whichever avatar mode the user has set (upload / preset /
 * initials) — the one place this branching logic lives, so topbar, profile,
 * and anywhere else a user's avatar shows up all stay in sync automatically.
 */
export function UserAvatar({
  user,
  size = 32,
  className,
}: {
  user: Pick<AuthUser, "displayName" | "avatarType" | "avatarPresetKey" | "avatarDataUrl">;
  size?: number;
  className?: string;
}) {
  if (user.avatarType === "upload" && user.avatarDataUrl) {
    return (
      <img
        src={user.avatarDataUrl}
        alt={user.displayName}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  if (user.avatarType === "preset" && user.avatarPresetKey) {
    return (
      <AvatarPresetBadge presetKey={user.avatarPresetKey} size={size} className={className} />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[color:var(--info)]/15 font-semibold text-[color:var(--info)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initialsOf(user.displayName || "?")}
    </span>
  );
}
