import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { AdminTable, StatusPill, type Column } from "@/components/soc/admin/admin-table";
import { useAdminOrganizations } from "@/hooks/use-admin";
import { shortDate, num } from "@/lib/admin-format";
import type { AdminOrgRow } from "@/types/admin";

export const Route = createFileRoute("/app/admin/organizations")({
  component: AdminOrganizations,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Organizations" }] }),
});

const PAGE_SIZE = 25;

function AdminOrganizations() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const query = useAdminOrganizations({
    page,
    search: search || undefined,
    status: status || undefined,
  });
  const data = query.data;

  const columns: Column<AdminOrgRow>[] = [
    {
      key: "name",
      header: "Organization",
      cell: (o) => <span className="font-medium">{o.name}</span>,
    },
    { key: "industry", header: "Industry", cell: (o) => o.industry ?? "—" },
    { key: "members", header: "Members", align: "right", cell: (o) => num(o.memberCount) },
    { key: "admins", header: "Admins", align: "right", cell: (o) => num(o.adminCount) },
    { key: "plan", header: "Plan", cell: (o) => o.plan ?? "—" },
    { key: "seats", header: "Active seats", align: "right", cell: (o) => o.activeSeats ?? "—" },
    { key: "created", header: "Created", cell: (o) => shortDate(o.createdAt) },
    {
      key: "status",
      header: "Status",
      cell: (o) => <StatusPill label={o.status} tone={o.status === "active" ? "ok" : "danger"} />,
    },
  ];

  const setAndReset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <AdminPage title="Organizations" description="Teams, cohorts, and institutions on ThreatLens.">
      <AdminTable
        title="All organizations"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(o) => o.id}
        onRowClick={(o) =>
          navigate({ to: "/app/admin/organizations/$orgId", params: { orgId: o.id } })
        }
        state={
          query.isPending
            ? "loading"
            : query.isError
              ? "error"
              : (data?.data.length ?? 0) === 0
                ? "empty"
                : "ready"
        }
        search={{ value: search, onChange: setAndReset(setSearch), placeholder: "Search by name" }}
        filters={[
          {
            key: "status",
            value: status,
            onChange: setAndReset(setStatus),
            options: [
              { value: "", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ],
          },
        ]}
        page={page}
        totalPages={data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1}
        total={data?.total ?? 0}
        onPage={setPage}
        busy={query.isFetching}
      />
    </AdminPage>
  );
}
