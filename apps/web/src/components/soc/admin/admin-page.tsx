import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SectionHeader } from "@/components/soc/primitives";
import { EmptyState } from "@/components/soc/ui/skeleton";
import { useAuthUser } from "@/lib/auth-store";

// Platform-admin sub-nav — the same five groups as the sidebar, shown as tabs across the top
// of every admin page so the section is navigable without collapsing the sidebar tree.
const ADMIN_TABS: { to: string; label: string }[] = [
  { to: "/app/admin", label: "Overview" },
  { to: "/app/admin/analytics", label: "Analytics" },
  { to: "/app/admin/users", label: "Users" },
  { to: "/app/admin/organizations", label: "Organizations" },
  { to: "/app/admin/certificates", label: "Certificates" },
  { to: "/app/admin/subscriptions", label: "Subscriptions" },
  { to: "/app/admin/revenue", label: "Revenue" },
  { to: "/app/admin/security", label: "Security" },
  { to: "/app/audit-logs", label: "Audit Logs" },
  { to: "/app/admin/administrators", label: "Administrators" },
  { to: "/app/admin/settings", label: "Settings" },
];

/**
 * Frame for every platform-admin page: the client-side platform_admin check (the API is the
 * real gate — this only avoids rendering a page that would 403), the section header, and the
 * shared sub-nav. Wrap the page body as children.
 */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const user = useAuthUser();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (user && user.role !== "platform_admin") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Platform Admin" />
        <EmptyState
          title="Restricted"
          description="This area is available to platform administrators only."
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader title={title} description={description} actions={actions} />

      <div className="mb-6 -mt-2 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {ADMIN_TABS.map((t) => {
          const active = t.to === "/app/admin" ? path === "/app/admin" : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                "whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors " +
                (active
                  ? "border-[color:var(--info)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
