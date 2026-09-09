import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPage } from "@/components/soc/admin/admin-page";
import { AdminTable, StatusPill, type Column } from "@/components/soc/admin/admin-table";
import { useAdminUsers } from "@/hooks/use-admin";
import { shortDate, relTime } from "@/lib/admin-format";
import type { AdminUserRow } from "@/types/admin";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsers,
  head: () => ({ meta: [{ title: "ThreatLens · Admin · Users" }] }),
});

const PAGE_SIZE = 25;

function AdminUsers() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [membership, setMembership] = useState("");

  const query = useAdminUsers({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: status || undefined,
    role: role || undefined,
    membership: (membership || undefined) as "individual" | "organization" | undefined,
  });
  const data = query.data;

  const columns: Column<AdminUserRow>[] = [
    {
      key: "user",
      header: "User",
      cell: (u) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{u.displayName}</div>
          <div className="truncate text-[11px] capitalize text-muted-foreground">
            {u.role.replace("_", " ")}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (u) => <span className="font-mono text-[11.5px]">{u.email}</span>,
    },
    { key: "org", header: "Organization", cell: (u) => u.organization?.name ?? "—" },
    { key: "plan", header: "Plan", cell: (u) => u.plan ?? "—" },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <StatusPill
          label={u.status.replace("_", " ")}
          tone={u.status === "active" ? "ok" : u.status === "suspended" ? "danger" : "warn"}
        />
      ),
    },
    { key: "joined", header: "Joined", cell: (u) => shortDate(u.joinedAt) },
    { key: "active", header: "Last Active", cell: (u) => relTime(u.lastActiveAt) },
  ];

  const setAndReset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <AdminPage title="Users" description="Every registered ThreatLens account.">
      <AdminTable
        title="All users"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(u) => u.id}
        onRowClick={(u) => navigate({ to: "/app/admin/users/$userId", params: { userId: u.id } })}
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
          placeholder: "Search name or email",
        }}
        filters={[
          {
            key: "status",
            value: status,
            onChange: setAndReset(setStatus),
            options: [
              { value: "", label: "Any status" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "pending_verification", label: "Pending verification" },
            ],
          },
          {
            key: "role",
            value: role,
            onChange: setAndReset(setRole),
            options: [
              { value: "", label: "Any role" },
              { value: "student", label: "Student" },
              { value: "instructor", label: "Instructor" },
              { value: "org_admin", label: "Org admin" },
              { value: "platform_admin", label: "Platform admin" },
            ],
          },
          {
            key: "membership",
            value: membership,
            onChange: setAndReset(setMembership),
            options: [
              { value: "", label: "All accounts" },
              { value: "individual", label: "Individuals" },
              { value: "organization", label: "In an organization" },
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
