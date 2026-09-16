import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { UserAvatar } from "@/components/soc/ui/user-avatar";
import {
  useMyOrganization,
  useCreateOrganization,
  useOrganizationMembers,
  useOrganizationInvites,
  useCreateInvite,
  useRenameOrganization,
  useSetOrgLogo,
  useRemoveOrgLogo,
  useSuspendMember,
  useRestoreMember,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
} from "@/hooks/use-organizations";
import { useAuthUser } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  Building2,
  Clock,
  Eye,
  Loader2,
  Mail,
  Pencil,
  RotateCcw,
  ShieldOff,
  Trash2,
  UserMinus,
  Upload,
  UserPlus,
  XCircle,
} from "lucide-react";
import type {
  InviteRole,
  OrganizationDto,
  OrganizationInviteDto,
  OrganizationMemberDto,
} from "@/types/threatlens-organizations";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const Route = createFileRoute("/app/organizations")({
  component: OrgsPage,
  head: () => ({ meta: [{ title: "ThreatLens · My Organization" }] }),
});

function OrgsPage() {
  const { organization, isPending } = useMyOrganization();

  if (isPending) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="My Organization" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return organization ? <OrgRoster organization={organization} /> : <CreateOrgPrompt />;
}

function CreateOrgPrompt() {
  const createOrg = useCreateOrganization();
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) createOrg.mutate(name.trim());
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="My Organization"
        description="Create an organization to manage a roster of analysts under one account."
      />
      <Panel className="max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Organization name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contoso University"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={createOrg.isPending || !name.trim()}
            className="h-9 self-start rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {createOrg.isPending ? "Creating…" : "Create organization"}
          </button>
          {createOrg.isError && (
            <p className="text-[12px] text-[color:var(--critical)]">
              Couldn't create that organization — try again.
            </p>
          )}
        </form>
      </Panel>
    </div>
  );
}

function OrgLogo({ organization, canEdit }: { organization: OrganizationDto; canEdit: boolean }) {
  const setLogo = useSetOrgLogo();
  const removeLogo = useRemoveOrgLogo();
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = setLogo.isPending || removeLogo.isPending;

  const onFile = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Logo must be a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Logo must be 2MB or smaller.");
      return;
    }
    setLogo.mutate(file, {
      onSuccess: () => toast.success("Logo updated"),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Couldn't upload that logo."),
    });
  };

  return (
    <div className="flex items-center gap-3">
      {organization.logoDataUrl ? (
        <img
          src={organization.logoDataUrl}
          alt={`${organization.name} logo`}
          className="size-12 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <IconTile tone="info" size="lg">
          <Building2 className="size-5" />
        </IconTile>
      )}
      {canEdit && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-secondary hover:text-foreground disabled:opacity-50"
            >
              {setLogo.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Upload className="size-3" />
              )}
              {organization.logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
            {organization.logoDataUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  removeLogo.mutate(undefined, {
                    onSuccess: () => toast.success("Logo removed"),
                    onError: () => toast.error("Couldn't remove the logo."),
                  })
                }
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:text-[color:var(--critical)] disabled:opacity-50"
              >
                <Trash2 className="size-3" /> Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OrgRoster({ organization }: { organization: OrganizationDto }) {
  const me = useAuthUser();
  const isOrgAdmin = me?.role === "org_admin";
  const {
    members,
    isPending: membersPending,
    isError: membersError,
  } = useOrganizationMembers(true);
  const { invites } = useOrganizationInvites(true);
  const createInvite = useCreateInvite();
  const resendInvite = useResendInvite();
  const revokeInvite = useRevokeInvite();
  const renameOrg = useRenameOrganization();
  const suspendMember = useSuspendMember();
  const restoreMember = useRestoreMember();
  const removeMember = useRemoveMember();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("student");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(organization.name);
  const [memberToView, setMemberToView] = useState<OrganizationMemberDto | null>(null);
  const [memberToSuspend, setMemberToSuspend] = useState<OrganizationMemberDto | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMemberDto | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<OrganizationInviteDto | null>(null);

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameDraft.trim() || nameDraft === organization.name) {
      setEditingName(false);
      return;
    }
    renameOrg.mutate(nameDraft.trim(), { onSuccess: () => setEditingName(false) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createInvite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail("");
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="My Organization"
        description="Roster and invitations for your team."
        actions={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <UserPlus className="size-3.5" /> Invite member
          </button>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-start gap-4">
          <OrgLogo organization={organization} canEdit={isOrgAdmin} />
          <div className="min-w-[200px] flex-1">
            {editingName ? (
              <form onSubmit={submitRename} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2.5 text-[13px] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={renameOrg.isPending}
                  className="h-8 rounded-md bg-primary px-2.5 text-[11.5px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  {renameOrg.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(organization.name);
                  }}
                  className="h-8 rounded-md border border-border px-2.5 text-[11.5px] text-secondary hover:text-foreground"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-medium">{organization.name}</div>
                {isOrgAdmin && (
                  <button
                    onClick={() => {
                      setNameDraft(organization.name);
                      setEditingName(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Rename organization"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="text-[12px] text-muted-foreground">
              {organization.memberCount} {organization.memberCount === 1 ? "member" : "members"}
            </div>
            {renameOrg.isError && (
              <p className="mt-1 text-[11.5px] text-[color:var(--critical)]">
                Couldn't rename the organization — try again.
              </p>
            )}
          </div>
        </div>
      </Panel>

      {showForm && (
        <Panel className="mt-4">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[220px] flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@example.com"
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Role
              </span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={createInvite.isPending || !email.trim()}
              className="h-9 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {createInvite.isPending ? "Sending…" : "Send invite"}
            </button>
          </form>
          {createInvite.isError && (
            <p className="mt-2 text-[12px] text-[color:var(--critical)]">
              Couldn't send that invite — try again.
            </p>
          )}
        </Panel>
      )}

      {invites.length > 0 && (
        <Panel padded={false} className="mt-4" title="Pending invites">
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-2.5 px-4 py-3 text-[12.5px]"
              >
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-[160px] flex-1 truncate">{i.email}</span>
                <span className="text-secondary capitalize">{i.role}</span>
                <span className="text-[11px] text-muted-foreground">
                  Expires {new Date(i.expiresAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  disabled={resendInvite.isPending && resendInvite.variables === i.id}
                  onClick={() =>
                    resendInvite.mutate(i.id, {
                      onSuccess: () => toast.success(`Invite resent to ${i.email}.`),
                      onError: (err) =>
                        toast.error(
                          err instanceof ApiError ? err.message : "Couldn't resend that invite.",
                        ),
                    })
                  }
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-secondary hover:text-foreground disabled:opacity-50"
                >
                  <Mail className="size-3" /> Resend
                </button>
                <button
                  type="button"
                  onClick={() => setInviteToRevoke(i)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:text-[color:var(--critical)]"
                >
                  <XCircle className="size-3" /> Revoke
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel padded={false} className="mt-4">
        {membersPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : membersError ? (
          <EmptyState
            title="Couldn't load the roster"
            description="Try reloading the page — this can happen right after creating an organization."
          />
        ) : members.length === 0 ? (
          <EmptyState title="No members yet" description="Invite your first analyst above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-background/50 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Member</th>
                  <th className="px-4 py-2.5 text-left">Role</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Last active</th>
                  <th className="px-4 py-2.5 text-left">Joined</th>
                  {isOrgAdmin && <th className="px-4 py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.userId} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar user={m} size={32} />
                        <div>
                          <div className="font-medium">{m.displayName}</div>
                          <div className="font-mono text-[10.5px] text-muted-foreground">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-secondary">
                      {m.role.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <MembershipStatusBadge status={m.orgMembershipStatus} />
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-muted-foreground">
                      {m.lastActiveAt ? formatRelativeTime(m.lastActiveAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-muted-foreground">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                    </td>
                    {isOrgAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setMemberToView(m)}
                            aria-label={`View ${m.displayName}`}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-secondary hover:text-foreground"
                          >
                            <Eye className="size-3" /> View
                          </button>
                          {m.userId !== me?.id && (
                            <>
                              {m.orgMembershipStatus === "suspended" ? (
                                <button
                                  type="button"
                                  disabled={
                                    restoreMember.isPending && restoreMember.variables === m.userId
                                  }
                                  onClick={() =>
                                    restoreMember.mutate(m.userId, {
                                      onSuccess: () =>
                                        toast.success(`${m.displayName}'s access was restored.`),
                                      onError: (err) =>
                                        toast.error(
                                          err instanceof ApiError
                                            ? err.message
                                            : "Couldn't restore that member.",
                                        ),
                                    })
                                  }
                                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-[color:var(--success)] hover:opacity-80 disabled:opacity-50"
                                >
                                  <RotateCcw className="size-3" /> Restore Access
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setMemberToSuspend(m)}
                                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:text-[color:var(--warning)]"
                                >
                                  <ShieldOff className="size-3" /> Suspend
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setMemberToRemove(m)}
                                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:text-[color:var(--critical)]"
                              >
                                <UserMinus className="size-3" /> Remove
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={memberToSuspend !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToSuspend(null);
        }}
        title="Suspend this member?"
        description={`This will temporarily prevent ${memberToSuspend?.displayName} from accessing resources and activities provided through ${organization.name}. Their ThreatLens account and personal data will remain intact.`}
        confirmLabel="Suspend Access"
        onConfirm={async () => {
          if (!memberToSuspend) return;
          await suspendMember.mutateAsync(memberToSuspend.userId);
          toast.success(`${memberToSuspend.displayName}'s organization access was suspended.`);
        }}
      />

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title="Remove this member?"
        description={`This will remove ${memberToRemove?.displayName} from ${organization.name} and revoke their access to this organization's workspace, cohorts, assignments, announcements, and other organization resources.`}
        note="Their personal ThreatLens account, investigation history, scores, and certificates will not be deleted."
        confirmLabel="Remove Member"
        onConfirm={async () => {
          if (!memberToRemove) return;
          await removeMember.mutateAsync(memberToRemove.userId);
          toast.success(`${memberToRemove.displayName} was removed from ${organization.name}.`);
        }}
      />

      <ConfirmDialog
        open={inviteToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setInviteToRevoke(null);
        }}
        title="Revoke this invitation?"
        description={`The invitation link sent to ${inviteToRevoke?.email} will stop working.`}
        confirmLabel="Revoke Invitation"
        onConfirm={async () => {
          if (!inviteToRevoke) return;
          await revokeInvite.mutateAsync(inviteToRevoke.id);
          toast.success(`Invitation to ${inviteToRevoke.email} was revoked.`);
        }}
      />

      <MemberDetailDialog
        member={memberToView}
        organizationName={organization.name}
        onOpenChange={(open) => {
          if (!open) setMemberToView(null);
        }}
      />
    </div>
  );
}

function MembershipStatusBadge({
  status,
}: {
  status: OrganizationMemberDto["orgMembershipStatus"];
}) {
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--warning)]/12 px-2 py-0.5 text-[11px] font-medium text-[color:var(--warning)]">
        <span className="size-1.5 rounded-full bg-[color:var(--warning)]" />
        Suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--success)]/12 px-2 py-0.5 text-[11px] font-medium text-[color:var(--success)]">
      <span className="size-1.5 rounded-full bg-[color:var(--success)]" />
      Active
    </span>
  );
}

function MemberDetailDialog({
  member,
  organizationName,
  onOpenChange,
}: {
  member: OrganizationMemberDto | null;
  organizationName: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border bg-card sm:max-w-md">
        {member && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UserAvatar user={member} size={44} />
                <div>
                  <DialogTitle className="text-foreground">{member.displayName}</DialogTitle>
                  <DialogDescription className="font-mono text-[11.5px]">
                    {member.email}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 text-[12.5px]">
              <div>
                <dt className="t-label text-muted-foreground">Role</dt>
                <dd className="mt-0.5 capitalize text-foreground">
                  {member.role.replace("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="t-label text-muted-foreground">Organization access</dt>
                <dd className="mt-0.5">
                  <MembershipStatusBadge status={member.orgMembershipStatus} />
                </dd>
              </div>
              <div>
                <dt className="t-label text-muted-foreground">ThreatLens account</dt>
                <dd className="mt-0.5 capitalize text-foreground">{member.accountStatus}</dd>
              </div>
              <div>
                <dt className="t-label text-muted-foreground">Last active</dt>
                <dd className="mt-0.5 text-foreground">
                  {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : "Never"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="t-label text-muted-foreground">Joined {organizationName}</dt>
                <dd className="mt-0.5 text-foreground">
                  {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "Unknown"}
                </dd>
              </div>
            </dl>

            <p className="mt-1 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              This member's personal ThreatLens account, investigation history, scores, and
              certificates exist independently of their membership in {organizationName}.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
