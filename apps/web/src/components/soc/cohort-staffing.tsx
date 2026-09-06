import { useState } from "react";
import { Panel } from "@/components/soc/primitives";
import {
  useCohortStaff,
  useCohortGroups,
  useCohortStaffMutations,
  useCohortGroupMutations,
  useCohortInvites,
  useCohortInviteMutations,
} from "@/hooks/use-instructor";
import { ApiError } from "@/lib/api-client";
import type { CohortStaffRole } from "@/types/threatlens-instructor";
import { Mail, Plus, Trash2, UserPlus, Users } from "lucide-react";

const INVITE_TONE: Record<string, string> = {
  pending: "var(--info)",
  accepted: "var(--success)",
  expired: "var(--muted-foreground)",
  revoked: "var(--muted-foreground)",
};

const ROLE_LABEL: Record<CohortStaffRole, string> = {
  lead: "Lead",
  tutor: "Tutor",
  group_tutor: "Group tutor",
};

const ROLE_HELP: Record<CohortStaffRole, string> = {
  lead: "Full control, including adding and removing staff.",
  tutor: "Teaches the whole cohort — assignments, review, feedback.",
  group_tutor: "Same, but only for the groups they are assigned to.",
};

/**
 * Managing who teaches a cohort and how its students are grouped.
 *
 * Server errors are surfaced verbatim rather than replaced with a generic message. The backend
 * refuses things for reasons a person needs to read — you cannot remove the only lead, you
 * cannot staff a student — and rewriting those as "something went wrong" would hide the one
 * piece of information that tells them what to do instead.
 */
export function CohortStaffing({ cohortId }: { cohortId: string }) {
  const staffQuery = useCohortStaff(cohortId);
  const groupsQuery = useCohortGroups(cohortId);
  const { addStaff, updateRole, removeStaff } = useCohortStaffMutations(cohortId);
  const { createGroup, deleteGroup, assignTutor, removeTutor } = useCohortGroupMutations(cohortId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CohortStaffRole>("tutor");
  const [groupName, setGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState("");

  const invitesQuery = useCohortInvites(cohortId);
  const { invite, revoke } = useCohortInviteMutations(cohortId);
  const invites = invitesQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const groupTutors = staff.filter((s) => s.role === "group_tutor");

  const errorOf = (e: unknown) =>
    e instanceof ApiError ? e.message : e ? "Something went wrong." : null;

  const staffError =
    errorOf(addStaff.error) ?? errorOf(updateRole.error) ?? errorOf(removeStaff.error);
  const inviteError = errorOf(invite.error) ?? errorOf(revoke.error);
  const groupError =
    errorOf(createGroup.error) ??
    errorOf(deleteGroup.error) ??
    errorOf(assignTutor.error) ??
    errorOf(removeTutor.error);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Teaching staff" padded={false}>
        <form
          className="flex flex-wrap items-end gap-2 border-b border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            addStaff.mutate({ email: email.trim(), role }, { onSuccess: () => setEmail("") });
          }}
        >
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Add by email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1 block text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CohortStaffRole)}
              className="h-9 rounded-md border border-border bg-background px-2 text-[13px] focus:outline-none"
            >
              {(["lead", "tutor", "group_tutor"] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={addStaff.isPending || !email.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <UserPlus className="size-3.5" /> {addStaff.isPending ? "Adding…" : "Add"}
          </button>
        </form>

        <p className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
          {ROLE_HELP[role]}
        </p>

        {staffError && (
          <p className="border-b border-border px-3 py-2 text-[12px] text-[color:var(--critical)]">
            {staffError}
          </p>
        )}

        <ul className="divide-y divide-border">
          {staff.map((s) => (
            <li key={s.userId} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{s.displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{s.email}</div>
                {s.groups.length > 0 && (
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    Runs {s.groups.map((g) => g.name).join(", ")}
                  </div>
                )}
              </div>
              <select
                value={s.role}
                disabled={updateRole.isPending}
                onChange={(e) =>
                  updateRole.mutate({
                    userId: s.userId,
                    role: e.target.value as CohortStaffRole,
                  })
                }
                className="h-8 rounded-md border border-border bg-background px-2 text-[12px] focus:outline-none disabled:opacity-50"
              >
                {(["lead", "tutor", "group_tutor"] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeStaff.mutate(s.userId)}
                disabled={removeStaff.isPending}
                aria-label={`Remove ${s.displayName} from this cohort`}
                className="grid size-8 shrink-0 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
          {staff.length === 0 && !staffQuery.isPending && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              Nobody staffed yet.
            </li>
          )}
        </ul>
      </Panel>

      <Panel title="Groups" padded={false}>
        <form
          className="flex items-end gap-2 border-b border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!groupName.trim()) return;
            createGroup.mutate(groupName.trim(), {
              onSuccess: () => setGroupName(""),
            });
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-[10.5px] uppercase tracking-wider text-muted-foreground">
              New group
            </span>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Seminar A"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={createGroup.isPending || !groupName.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Create
          </button>
        </form>

        {groupError && (
          <p className="border-b border-border px-3 py-2 text-[12px] text-[color:var(--critical)]">
            {groupError}
          </p>
        )}

        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <li key={g.id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Users className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{g.name}</div>
                  <div className="text-[10.5px] tabular-nums text-muted-foreground">
                    {g.studentCount} student{g.studentCount === 1 ? "" : "s"} · {g.assignmentCount}{" "}
                    assignment{g.assignmentCount === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  onClick={() => deleteGroup.mutate(g.id)}
                  disabled={deleteGroup.isPending}
                  aria-label={`Delete group ${g.name}`}
                  className="grid size-8 shrink-0 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                {g.tutors.map((t) => (
                  <span
                    key={t.userId}
                    className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10.5px]"
                  >
                    {t.displayName}
                    <button
                      onClick={() => removeTutor.mutate({ groupId: g.id, userId: t.userId })}
                      aria-label={`Remove ${t.displayName} from ${g.name}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}

                {/* Only a group_tutor is scoped to particular groups — a lead or tutor already
                 * covers the whole cohort, so offering them here would be misleading. */}
                {groupTutors.length > 0 && (
                  <select
                    value=""
                    onChange={(e) =>
                      e.target.value &&
                      assignTutor.mutate({ groupId: g.id, userId: e.target.value })
                    }
                    className="h-7 rounded border border-border bg-background px-1.5 text-[10.5px] text-muted-foreground focus:outline-none"
                  >
                    <option value="">Assign tutor…</option>
                    {groupTutors
                      .filter((t) => !g.tutors.some((existing) => existing.userId === t.userId))
                      .map((t) => (
                        <option key={t.userId} value={t.userId}>
                          {t.displayName}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </li>
          ))}
          {groups.length === 0 && !groupsQuery.isPending && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No groups. A cohort works fine without them — add one when you need to split students
              between tutors.
            </li>
          )}
        </ul>
      </Panel>

      <Panel title="Invitations" padded={false} className="lg:col-span-2">
        {/* The join code still exists and is still the right tool for reading out to a room.
         * An invitation is the right tool for a list of names: it is addressed to one
         * person, can be withdrawn from them alone, and expires on its own. */}
        <form
          className="flex flex-wrap items-end gap-2 border-b border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!inviteEmail.trim()) return;
            invite.mutate(
              {
                email: inviteEmail.trim(),
                groupId: inviteGroupId || undefined,
              },
              { onSuccess: () => setInviteEmail("") },
            );
          }}
        >
          <label className="flex-1 min-w-[200px]">
            <span className="mb-1 block text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Invite by email
            </span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="analyst@example.com"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
            />
          </label>
          {groups.length > 0 && (
            <label>
              <span className="mb-1 block text-[10.5px] uppercase tracking-wider text-muted-foreground">
                Into group
              </span>
              <select
                value={inviteGroupId}
                onChange={(e) => setInviteGroupId(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-[13px] focus:outline-none"
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            disabled={invite.isPending || !inviteEmail.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <Mail className="size-3.5" /> {invite.isPending ? "Sending…" : "Send invite"}
          </button>
        </form>

        {inviteError && (
          <p className="border-b border-border px-3 py-2 text-[12px] text-[color:var(--critical)]">
            {inviteError}
          </p>
        )}

        <ul className="divide-y divide-border">
          {invites.map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px]">{i.email}</div>
                <div className="text-[10.5px] text-muted-foreground">
                  {i.groupName ? `${i.groupName} · ` : ""}
                  {i.status === "pending"
                    ? `expires ${new Date(i.expiresAt).toLocaleDateString()}`
                    : i.status === "accepted" && i.acceptedAt
                      ? `joined ${new Date(i.acceptedAt).toLocaleDateString()}`
                      : i.status}
                </div>
              </div>
              <span
                className="rounded border px-1.5 py-0.5 text-[10.5px] capitalize"
                style={{ color: INVITE_TONE[i.status], borderColor: INVITE_TONE[i.status] }}
              >
                {i.status}
              </span>
              {i.status !== "accepted" && (
                <button
                  onClick={() => revoke.mutate(i.id)}
                  disabled={revoke.isPending}
                  aria-label={`Withdraw the invitation to ${i.email}`}
                  className="grid size-8 shrink-0 place-items-center rounded border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </li>
          ))}
          {invites.length === 0 && !invitesQuery.isPending && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              Nobody invited yet. Invited people get an email with a link that signs them straight
              into this cohort.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
