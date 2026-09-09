import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldPlus } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { StatusPill } from "@/components/soc/admin/admin-table";
import { useAuthUser } from "@/lib/auth-store";
import {
  useAdministrators,
  useGrantAdministrator,
  useRevokeAdministrator,
} from "@/hooks/use-admin";
import { shortDate, relTime } from "@/lib/admin-format";
import type { AdministratorRow } from "@/types/admin";

export const Route = createFileRoute("/app/admin/administrators")({
  component: AdminAdministrators,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Administrators" }] }),
});

function AdminAdministrators() {
  const me = useAuthUser();
  const { data, isPending, isError } = useAdministrators();
  const grant = useGrantAdministrator();
  const revoke = useRevokeAdministrator();
  const [email, setEmail] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AdministratorRow | null>(null);

  return (
    <AdminPage
      title="Administrators"
      description="Platform administrators can access every section of this panel. Role-based access is enforced by the API."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title={`Platform administrators · ${data?.length ?? 0}`} padded={false}>
            {isPending ? (
              <div className="p-3">
                <Skeleton className="h-32" />
              </div>
            ) : isError || !data ? (
              <EmptyState
                title="Unavailable"
                description="Restricted to platform administrators."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Administrator</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium">MFA</th>
                      <th className="px-4 py-2.5 font-medium">Last activity</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.map((a) => (
                      <tr key={a.id} className="hover:bg-background/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{a.displayName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {a.email}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusPill label="platform admin" tone="info" />
                        </td>
                        <td className="px-4 py-2.5 text-secondary">
                          {a.mfaEnabled ? "Enabled" : "Not enabled"}
                        </td>
                        <td className="px-4 py-2.5 text-secondary">{relTime(a.lastActivityAt)}</td>
                        <td className="px-4 py-2.5 text-secondary">{shortDate(a.createdAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {a.id !== me?.id && data.length > 1 && (
                            <button
                              className="text-[12px] font-medium text-[color:var(--critical)] hover:underline"
                              disabled={revoke.isPending}
                              onClick={() => setRevokeTarget(a)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div>
          <Panel title="Add an administrator">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) grant.mutate(email.trim(), { onSuccess: () => setEmail("") });
              }}
            >
              <label className="block">
                <span className="t-label mb-1 block">Account email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="person@company.com"
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button className="btn-app-primary w-full justify-center" disabled={grant.isPending}>
                {grant.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldPlus className="size-3.5" />
                )}
                Grant platform admin
              </button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The account must already exist, have a verified email, and be active. The role takes
                effect on their next sign-in, which forces MFA enrolment. The change is recorded in
                the audit log.
              </p>
            </form>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Remove platform admin?"
        description="This account will lose access to the entire admin panel and be signed out:"
        target={revokeTarget?.email}
        note="Their account becomes a regular student account. Reversible by granting the role again."
        confirmLabel="Remove admin role"
        tone="destructive"
        onConfirm={async () => {
          if (revokeTarget) await revoke.mutateAsync(revokeTarget.id);
          setRevokeTarget(null);
        }}
      />
    </AdminPage>
  );
}
