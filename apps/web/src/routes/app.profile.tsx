import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Award, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { useProfile } from "@/hooks/use-profile";
import { useAuthStore, useAuthUser } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { UserAvatar } from "@/components/soc/ui/user-avatar";
import { AvatarPickerDialog } from "@/components/soc/avatar-picker-dialog";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "ThreatLens · Profile" }] }),
});

function AboutYouPanel() {
  const user = useAuthUser();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    professionalRole: "",
    bio: "",
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      professionalRole: user.professionalRole ?? "",
      bio: user.bio ?? "",
    });
  }, [user?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Profile updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="About you"
      actions={
        !editing && (
          <button className="btn-app-ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Edit
          </button>
        )
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <UserAvatar user={user} size={72} />
          <button className="t-meta text-[color:var(--info)] hover:underline" onClick={() => setAvatarOpen(true)}>
            Change avatar
          </button>
        </div>

        <div className="flex-1 space-y-3">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="t-label mb-1 block">First name</span>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <label className="block">
                  <span className="t-label mb-1 block">Last name</span>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
              <label className="block">
                <span className="t-label mb-1 block">Professional role</span>
                <input
                  value={form.professionalRole}
                  onChange={(e) => setForm((f) => ({ ...f, professionalRole: e.target.value }))}
                  placeholder="e.g. SOC Analyst, IT Support Specialist"
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="block">
                <span className="t-label mb-1 block">Bio</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  maxLength={600}
                  className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="flex items-center gap-2">
                <button className="btn-app-primary" disabled={saving} onClick={save}>
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  Save
                </button>
                <button className="btn-app-ghost" disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[15px] font-semibold">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.displayName}
              </div>
              {user.professionalRole && (
                <div className="text-[12px] text-muted-foreground">{user.professionalRole}</div>
              )}
              <p className="text-[12.5px] leading-relaxed text-secondary">
                {user.bio || "No bio yet — click Edit to add one."}
              </p>
            </>
          )}
        </div>
      </div>

      <AvatarPickerDialog open={avatarOpen} onOpenChange={setAvatarOpen} />
    </Panel>
  );
}

function ProfilePage() {
  const { summary, skillMastery, certificates } = useProfile();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Profile"
        description="Your analyst identity, performance, and preferences."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <AboutYouPanel />

          <Panel>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Score", summary?.score],
                ["Solved", summary?.solved],
                ["Rank", summary?.rank],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-border bg-background/40 p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l}
                  </div>
                  <div className="mt-0.5 text-[14px] font-semibold">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 font-mono text-[11px] text-muted-foreground">
              {summary?.email}
            </div>
          </Panel>
        </div>

        <Panel className="lg:col-span-2" title="Skills mastery" padded={false}>
          <div className="p-4">
            {skillMastery.length === 0 && (
              <p className="py-2 text-[12px] text-muted-foreground">
                Complete and score an investigation in each category to see your mastery here.
              </p>
            )}
            {skillMastery.map((s) => (
              <div key={s.label} className="mb-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-secondary">{s.label}</span>
                  <span className="tabular-nums text-secondary">{s.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-[color:var(--info)]"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Certificates
            </div>
            {certificates.length === 0 && (
              <p className="py-1 text-[12px] text-muted-foreground">
                Complete a learning path to earn your first certificate.
              </p>
            )}
            {certificates.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1 text-[12.5px]">
                <Award className="size-3.5 text-[color:var(--info)]" />
                {c.learningPathTitle}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
