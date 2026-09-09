import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ShieldOff, ShieldCheck, KeyRound } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { StatusPill } from "@/components/soc/admin/admin-table";
import { useAdminUser, useSetUserStatus, useResetUserMfa } from "@/hooks/use-admin";
import { shortDate, relTime, humaniseAction, pct } from "@/lib/admin-format";

export const Route = createFileRoute("/app/admin/users/$userId")({
  component: UserDetail,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · User" }] }),
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px]">{value}</div>
    </div>
  );
}

function UserDetail() {
  const { userId } = useParams({ from: "/app/admin/users/$userId" });
  const { data: user, isPending, isError } = useAdminUser(userId);
  const setStatus = useSetUserStatus();
  const resetMfa = useResetUserMfa();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);

  return (
    <AdminPage
      title="User"
      description="Account and platform activity."
      actions={
        <Link to="/app/admin/users" className="btn-app-ghost">
          <ArrowLeft className="size-3.5" /> All users
        </Link>
      }
    >
      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError || !user ? (
        <EmptyState title="User not found" description="This account may have been removed." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Account">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Name" value={user.displayName} />
                <Field
                  label="Email"
                  value={<span className="font-mono text-[12px]">{user.email}</span>}
                />
                <Field
                  label="Role"
                  value={<span className="capitalize">{user.role.replace("_", " ")}</span>}
                />
                <Field
                  label="Status"
                  value={
                    <StatusPill
                      label={user.status.replace("_", " ")}
                      tone={
                        user.status === "active"
                          ? "ok"
                          : user.status === "suspended"
                            ? "danger"
                            : "warn"
                      }
                    />
                  }
                />
                <Field label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
                <Field label="MFA" value={user.mfaEnabled ? "Enabled" : "Not enabled"} />
                <Field label="Registered" value={shortDate(user.createdAt)} />
                <Field label="Last sign-in" value={relTime(user.lastLoginAt)} />
                <Field
                  label="Organization"
                  value={
                    user.organization ? (
                      <Link
                        to="/app/admin/organizations/$orgId"
                        params={{ orgId: user.organization.id }}
                        className="text-[color:var(--info)] hover:underline"
                      >
                        {user.organization.name}
                      </Link>
                    ) : (
                      "Individual"
                    )
                  }
                />
              </div>
            </Panel>

            <Panel title="Investigation performance">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Completed" value={user.performance.investigationsCompleted} />
                <Field label="Average score" value={pct(user.performance.averageScore)} />
                <Field label="Best score" value={pct(user.performance.bestScore)} />
                <Field label="Certificates" value={user.performance.certificates} />
              </div>
            </Panel>

            <Panel title="Recent activity" padded={false}>
              {user.recentActivity.length === 0 ? (
                <p className="p-4 text-[12px] text-muted-foreground">No recorded activity.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {user.recentActivity.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5 text-[12.5px]"
                    >
                      <span>
                        {humaniseAction(a.action)}
                        {!a.bySelf && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            by an admin
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {relTime(a.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="space-y-3">
            <Panel title="Actions">
              <div className="space-y-2">
                {user.status === "suspended" ? (
                  <button
                    className="btn-app-secondary w-full justify-center"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: user.id, status: "active" })}
                  >
                    <ShieldCheck className="size-3.5" /> Reactivate account
                  </button>
                ) : (
                  <button
                    className="btn-app-danger w-full justify-center"
                    disabled={setStatus.isPending}
                    onClick={() => setSuspendOpen(true)}
                  >
                    <ShieldOff className="size-3.5" /> Suspend account
                  </button>
                )}
                <button
                  className="btn-app-ghost w-full justify-center"
                  disabled={resetMfa.isPending || !user.mfaEnabled}
                  onClick={() => setMfaOpen(true)}
                >
                  <KeyRound className="size-3.5" /> Reset MFA
                </button>
                <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Reset MFA clears the authenticator and recovery codes and revokes active sessions.
                  It never exposes the secret. The user re-enrols on next sign-in.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend this account?"
        description="The user will be signed out immediately and blocked from signing in until reactivated:"
        target={user?.email}
        note="Their data and investigation history are kept. This is reversible."
        confirmLabel="Suspend account"
        tone="destructive"
        onConfirm={async () => {
          if (user) await setStatus.mutateAsync({ id: user.id, status: "suspended" });
        }}
      />
      <ConfirmDialog
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        title="Reset this user's MFA?"
        description="Use this only when the user has genuinely lost access to their authenticator:"
        target={user?.email}
        note="Active sessions are revoked. The user re-enrols MFA on next sign-in."
        confirmLabel="Reset MFA"
        tone="destructive"
        onConfirm={async () => {
          if (user) await resetMfa.mutateAsync(user.id);
        }}
      />
    </AdminPage>
  );
}
