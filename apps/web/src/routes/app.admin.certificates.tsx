import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { AdminTable, StatusPill, type Column } from "@/components/soc/admin/admin-table";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import {
  useAdminCertificates,
  useRevokeCertificate,
  useReissueCertificate,
} from "@/hooks/use-admin";
import { shortDate } from "@/lib/admin-format";
import type { AdminCertificateRow } from "@/types/admin";

export const Route = createFileRoute("/app/admin/certificates")({
  component: AdminCertificates,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Certificates" }] }),
});

const PAGE_SIZE = 25;

function AdminCertificates() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AdminCertificateRow | null>(null);

  const query = useAdminCertificates({
    page,
    search: search || undefined,
    status: status || undefined,
  });
  const data = query.data;
  const revoke = useRevokeCertificate();
  const reissue = useReissueCertificate();

  const columns: Column<AdminCertificateRow>[] = [
    {
      key: "holder",
      header: "Holder",
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{c.holder.displayName}</div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {c.holder.email}
          </div>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (c) => c.type },
    { key: "issued", header: "Issued", cell: (c) => shortDate(c.issuedAt) },
    {
      key: "verification",
      header: "Verification ID",
      cell: (c) => <span className="font-mono text-[11px]">{c.verificationId.slice(0, 8)}…</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusPill label={c.status} tone={c.status === "active" ? "ok" : "muted"} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) =>
        c.status === "active" ? (
          <button
            className="text-[12px] font-medium text-[color:var(--critical)] hover:underline"
            disabled={revoke.isPending}
            onClick={() => setRevokeTarget(c)}
          >
            Revoke
          </button>
        ) : (
          <button
            className="text-[12px] font-medium text-[color:var(--info)] hover:underline"
            disabled={reissue.isPending}
            onClick={() => reissue.mutate(c.id)}
          >
            Reissue
          </button>
        ),
    },
  ];

  const setAndReset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <AdminPage
      title="Certificates"
      description="Every certificate issued across the platform. Public verification is unaffected by actions here."
    >
      <AdminTable
        title={`Certificates · ${data?.total ?? 0} issued`}
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(c) => c.id}
        state={
          query.isPending
            ? "loading"
            : query.isError
              ? "error"
              : (data?.data.length ?? 0) === 0
                ? "empty"
                : "ready"
        }
        search={{
          value: search,
          onChange: setAndReset(setSearch),
          placeholder: "Search holder or certificate type",
        }}
        filters={[
          {
            key: "status",
            value: status,
            onChange: setAndReset(setStatus),
            options: [
              { value: "", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "revoked", label: "Revoked" },
            ],
          },
        ]}
        page={page}
        totalPages={data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1}
        total={data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Revoke this certificate?"
        description="The public verification page will show it as revoked:"
        target={revokeTarget ? `${revokeTarget.type} — ${revokeTarget.holder.email}` : undefined}
        note="Reversible — you can reissue it later."
        confirmLabel="Revoke certificate"
        tone="destructive"
        onConfirm={async () => {
          if (revokeTarget) await revoke.mutateAsync({ id: revokeTarget.id });
          setRevokeTarget(null);
        }}
      />
    </AdminPage>
  );
}
