import { useRef, useState } from "react";
import { Check, Loader2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AVATAR_PRESETS, avatarPresetSrc } from "@/components/soc/ui/avatar-presets";
import { UserAvatar } from "@/components/soc/ui/user-avatar";
import { useAuthStore, useAuthUser } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";

export function AvatarPickerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthUser();
  const setAvatarPreset = useAuthStore((s) => s.setAvatarPreset);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const [pending, setPending] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const choosePreset = async (key: string | null) => {
    setPending(key ?? "initials");
    try {
      await setAvatarPreset(key);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update your avatar.");
    } finally {
      setPending(null);
    }
  };

  const onFileChosen = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be 2MB or smaller.");
      return;
    }
    setPending("upload");
    try {
      await uploadAvatar(file);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed. Try a smaller image.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle>Choose Your ThreatLens Avatar</DialogTitle>
          <DialogDescription>Upload a photo, use your initials, or pick a role.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size={56} />
            <div className="flex flex-col gap-1.5">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileChosen(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="btn-app-secondary"
                disabled={pending !== null}
                onClick={() => fileInput.current?.click()}
              >
                {pending === "upload" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Upload photo
              </button>
              <span className="t-meta text-muted-foreground">JPEG, PNG, or WEBP · up to 2MB</span>
            </div>
          </div>

          <div>
            <span className="t-label mb-2 block">Initials</span>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => choosePreset(null)}
              className="flex w-full items-center gap-3 rounded-md border border-border bg-background/40 p-2.5 text-left transition-colors hover:border-[color:var(--info)]/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--info)]/15 text-[13px] font-semibold text-[color:var(--info)]">
                <User className="size-4" />
              </span>
              <span className="flex-1 text-[13px]">Use my initials</span>
              {user.avatarType === "initials" && (
                <Check className="size-4 text-[color:var(--info)]" />
              )}
              {pending === "initials" && <Loader2 className="size-3.5 animate-spin" />}
            </button>
          </div>

          <div>
            <span className="t-label mb-2 block">ThreatLens Avatars</span>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const active = user.avatarType === "preset" && user.avatarPresetKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    disabled={pending !== null}
                    onClick={() => choosePreset(preset.key)}
                    aria-pressed={active}
                    className={`transition-app relative flex flex-col items-center gap-1.5 rounded-md border bg-background/40 p-2.5 hover:border-[color:var(--info)]/50 ${
                      active ? "border-[color:var(--info)]" : "border-border"
                    }`}
                  >
                    {active && (
                      <Check className="absolute right-1.5 top-1.5 size-3.5 text-[color:var(--info)]" />
                    )}
                    <span className="relative grid size-11 place-items-center">
                      <img
                        src={avatarPresetSrc(preset.key)}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-full object-cover"
                        draggable={false}
                      />
                      {pending === preset.key && (
                        <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
                          <Loader2 className="size-4 animate-spin" />
                        </span>
                      )}
                    </span>
                    <span className="text-center text-[10.5px] leading-tight text-secondary">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
