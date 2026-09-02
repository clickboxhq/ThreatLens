import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import {
  useMyOrganization,
  useCreateOrganization,
  useOrganizationMembers,
  useOrganizationInvites,
  useCreateInvite,
  useRenameOrganization,
} from "@/hooks/use-organizations";
import { Building2, Clock, Pencil, UserPlus } from "lucide-react";
import type { InviteRole } from "@/types/threatlens-organizations";

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

function OrgRoster({
  organization,
}: {
  organization: { id: string; name: string; memberCount: number };
}) {
  const {
    members,
    isPending: membersPending,
    isError: membersError,
  } = useOrganizationMembers(true);
  const { invites } = useOrganizationInvites(true);
  const createInvite = useCreateInvite();
  const renameOrg = useRenameOrganization();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("student");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(organization.name);

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
        <div className="flex items-center gap-3">
          <IconTile tone="info" size="lg">
            <Building2 className="size-5" />
          </IconTile>
          <div className="flex-1">
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
              <li key={i.id} className="flex items-center gap-2.5 px-4 py-3 text-[12.5px]">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="flex-1">{i.email}</span>
                <span className="text-secondary capitalize">{i.role}</span>
                <span className="text-[11px] text-muted-foreground">
                  Expires {new Date(i.expiresAt).toLocaleDateString()}
                </span>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.userId} className="hover:bg-background/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <IconTile
                          tone="info"
                          size="sm"
                          shape="circle"
                          className="text-[10.5px] font-semibold"
                        >
                          {m.displayName
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </IconTile>
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
                    <td className="px-4 py-3 capitalize text-[color:var(--success)]">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
