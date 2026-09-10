import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, ShieldOff, ShieldCheck } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { StatusPill } from "@/components/soc/admin/admin-table";
import { useAdminOrganization, useSetOrgStatus } from "@/hooks/use-admin";
import { shortDate, relTime, humaniseAction, num } from "@/lib/admin-format";

export const Route = createFileRoute("/app/admin/organizations/$orgId")({
  component: OrgDetail,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Organization" }] }),
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px]">{value}</div>
    </div>
  );
}

function OrgDetail() {
  const { orgId } = useParams({ from: "/app/admin/organizations/$orgId" });
  const { data: org, isPending, isError } = useAdminOrganization(orgId);
  const setStatus = useSetOrgStatus();
  const [suspendOpen, setSuspendOpen] = useState(false);

  return (
    <AdminPage
      title="Organization"
      description="Membership and platform usage."
      actions={
        <Link to="/app/admin/organizations" className="btn-app-ghost">
          <ArrowLeft className="size-3.5" /> All organizations
        </Link>
      }
    >
      {isPending ? (
        <Skeleton className="h-64" />
      ) : isError || !org ? (
        <EmptyState title="Organization not found" description="It may have been removed." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Details">
              <div className="flex items-start gap-3">
                {org.logoDataUrl ? (
                  <img
                    src={org.logoDataUrl}
                    alt={`${org.name} logo`}
                    className="size-10 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-background">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
                  <Field label="Name" value={org.name} />
                  <Field label="Industry" value={org.industry ?? "—"} />
                  <Field
                    label="Status"
                    value={
                      <StatusPill
                        label={org.status}
                        tone={org.status === "active" ? "ok" : "danger"}
                      />
                    }
                  />
                  <Field label="Members" value={num(org.members.length)} />
                  <Field label="Active cohorts" value={num(org.usage.activeCohorts)} />
                  <Field
                    label="Investigations completed"
                    value={num(org.usage.investigationsCompleted)}
                  />
                  <Field label="Created" value={shortDate(org.createdAt)} />
                  {org.suspendedAt && (
                    <Field label="Suspended" value={shortDate(org.suspendedAt)} />
                  )}
                </div>
              </div>
            </Panel>

            <Panel title={`Members · ${org.members.length}`} padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Member</th>
                      <th className="px-4 py-2.5 font-medium">Role</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {org.members.map((m) => (
                      <tr key={m.id} className="hover:bg-background/40">
                        <td className="px-4 py-2.5">
                          <Link
                            to="/app/admin/users/$userId"
                            params={{ userId: m.id }}
                            className="hover:underline"
                          >
                            <span className="font-medium">{m.displayName}</span>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                              {m.email}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 capitalize text-secondary">
                          {m.role.replace("_", " ")}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-secondary">{m.status}</td>
                        <td className="px-4 py-2.5 text-secondary">{relTime(m.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Recent activity" padded={false}>
              {org.recentActivity.length === 0 ? (
                <p className="p-4 text-[12px] text-muted-foreground">No recorded activity.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {org.recentActivity.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-4 py-2.5 text-[12.5px]"
                    >
                      <span>{humaniseAction(a.action)}</span>
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
              {org.status === "suspended" ? (
                <button
                  className="btn-app-secondary w-full justify-center"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: org.id, status: "active" })}
                >
                  <ShieldCheck className="size-3.5" /> Reactivate organization
                </button>
              ) : (
                <button
                  className="btn-app-danger w-full justify-center"
                  disabled={setStatus.isPending}
                  onClick={() => setSuspendOpen(true)}
                >
                  <ShieldOff className="size-3.5" /> Suspend organization
                </button>
              )}
              <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
                Suspending an organization is a platform-side flag. Members keep their individual
                accounts.
              </p>
            </Panel>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend this organization?"
        description="Flags the organization as suspended platform-side:"
        target={org?.name}
        note="Members' individual accounts are unaffected. This is reversible."
        confirmLabel="Suspend organization"
        tone="destructive"
        onConfirm={async () => {
          if (org) await setStatus.mutateAsync({ id: org.id, status: "suspended" });
        }}
      />
    </AdminPage>
  );
}
