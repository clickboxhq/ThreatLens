import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  ShieldAlert,
  Bell,
  Inbox,
  ListTree,
  UserRound,
  MonitorSmartphone,
  Mail,
  Radar,
  Search,
  Library,
  GraduationCap,
  Award,
  BarChart3,
  FileText,
  Presentation,
  Building2,
  Settings as SettingsIcon,
  CircleUserRound,
  CreditCard,
  BookOpen,
  LifeBuoy,
  HardDrive,
  ChevronsUpDown,
  Command,
  Bell as BellIcon,
  Sparkles,
  Crosshair,
  Medal,
  Trophy,
  Wrench,
  Users,
  ClipboardCheck,
  MessageSquare,
  ScrollText,
  Activity,
  Menu,
  X,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { CommandPalette, useCommandPalette } from "@/components/soc/command-palette";
import { NotificationPanel } from "@/components/soc/notification-panel";
import { useNotifications } from "@/hooks/use-notifications";
import { PageTransition } from "@/components/soc/ui/motion";
import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { useAuthStore, useAuthUser } from "@/lib/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const primary: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/alerts", label: "Alert Center", icon: Bell, badge: "48" },
  { to: "/app/incidents", label: "Incident Queue", icon: ShieldAlert, badge: "12" },
  { to: "/app/cases", label: "Case Management", icon: Inbox, badge: "8" },
  { to: "/app/timeline", label: "Global Timeline", icon: ListTree },
  { to: "/app/evidence", label: "Evidence Locker", icon: HardDrive },
];

const portals: NavItem[] = [
  { to: "/app/identity", label: "Identity Center", icon: UserRound },
  { to: "/app/endpoints", label: "Device Center", icon: MonitorSmartphone },
  { to: "/app/email", label: "Email Investigation", icon: Mail },
  { to: "/app/threat-intel", label: "Threat Intelligence", icon: Radar },
  { to: "/app/search", label: "Global Search", icon: Search },
];

const learning: NavItem[] = [
  { to: "/app/scenarios", label: "Scenario Library", icon: Library },
  { to: "/app/learning", label: "Learning Center", icon: GraduationCap },
  { to: "/app/mitre", label: "MITRE ATT&CK Explorer", icon: Crosshair },
  { to: "/app/achievements", label: "Achievements", icon: Medal },
  { to: "/app/certificates", label: "Certificates", icon: Award },
  { to: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
];

// Organization accounts only — instructors, cohorts, and org-scoped admin.
// Nothing platform-operator-wide lives here or anywhere in /app; a true
// cross-tenant admin surface is future, separate infrastructure
// (admin.threatlens.useclickbox.com), not something linked from this nav.
const instructorTools: NavItem[] = [
  { to: "/app/instructor", label: "Instructor Portal", icon: Presentation },
  { to: "/app/student-analytics", label: "Student Analytics", icon: BarChart3 },
  { to: "/app/scenario-builder", label: "Scenario Builder", icon: Wrench },
  { to: "/app/cohorts", label: "Cohorts", icon: Users },
  { to: "/app/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/app/feedback", label: "Feedback Center", icon: MessageSquare },
];

const organization: NavItem[] = [
  { to: "/app/organizations", label: "My Organization", icon: Building2 },
  { to: "/app/reports", label: "Reports", icon: FileText },
  { to: "/app/analytics", label: "Analytics", icon: Activity },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
  { to: "/app/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

function NavGroup({ label, items }: { label?: string; items: NavItem[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="px-2">
      {label && (
        <div className="mb-1 px-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {items.map((it) => {
          const active = it.to === "/app" ? path === "/app" : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md py-1.5 pl-3.5 pr-2 text-[13px] transition-all duration-150",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[color:var(--info)]"
                  />
                )}
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-[5px] transition-colors",
                    active ? "bg-[color:var(--info)]/15" : "",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active
                        ? "text-[color:var(--info)]"
                        : "text-muted-foreground group-hover:text-secondary",
                    )}
                  />
                </span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.badge && (
                  <span className="rounded border border-[color:var(--card-border-tint)] bg-background/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-secondary">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthUser();
  // "Organization" nav (instructor tools, org settings) now gates on the real role SOCVerse
  // issued at signup/login, not the old accountType mock flag — org_admin included for when a
  // real admin-provisioned account (no self-serve path) logs in.
  const isOrg = user?.role === "instructor" || user?.role === "org_admin";
  const accountName = user?.displayName ?? "Account";

  return (
    <>
      {/* Workspace switcher */}
      <div className="p-3">
        <button className="flex w-full items-center gap-2.5 rounded-md border border-[color:var(--card-border-tint)] bg-background/40 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent/50">
          <IconTile tone="info" size="sm">
            {isOrg ? <Building2 className="size-4" /> : <CircleUserRound className="size-4" />}
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{accountName}</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {isOrg ? "Organization workspace" : "Individual"}
            </div>
          </div>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4" onClick={onNavigate}>
        <NavGroup label="Investigations" items={primary} />
        <NavGroup label="Investigation Portals" items={portals} />
        <NavGroup label="Learning" items={learning} />
        {isOrg && <NavGroup label="Instructor Tools" items={instructorTools} />}
        {isOrg && <NavGroup label="Organization" items={organization} />}
      </nav>

      {/* Footer: subscription + storage */}
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-[color:var(--card-border-tint)] bg-background/40 p-3">
          <div className="flex items-center gap-2 text-[11px] text-secondary">
            <Sparkles className="size-3.5 text-[color:var(--info)]" />
            <span className="font-medium text-foreground">
              {isOrg ? "Cohort Plan" : "Individual Plan"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Storage</span>
            <span className="tabular-nums">{isOrg ? "184 / 500 GB" : "1.2 / 5 GB"}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-[color:var(--info)]"
              style={{ width: isOrg ? "36%" : "24%" }}
            />
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <a href="#" className="inline-flex items-center gap-1 hover:text-foreground">
              <BookOpen className="size-3.5" /> Docs
            </a>
            <a href="#" className="inline-flex items-center gap-1 hover:text-foreground">
              <LifeBuoy className="size-3.5" /> Support
            </a>
            {isOrg ? (
              <Link
                to="/app/billing"
                className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
              >
                <CreditCard className="size-3.5" /> Billing
              </Link>
            ) : (
              <Link
                to="/"
                hash="pricing"
                className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
              >
                <CreditCard className="size-3.5" /> Upgrade
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="flex items-center justify-between border-b border-sidebar-border p-3">
        <Link to="/" className="flex items-center gap-2">
          <Mark className="size-6" />
          <span className="text-foreground">
            <BrandLockup size="footer" />
          </span>
        </Link>
        <Link
          to="/"
          aria-label="Back to platform"
          title="Back to platform"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </div>
      <SidebarBody />
    </aside>
  );
}

function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[82vw] flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-between border-b border-sidebar-border p-3">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2"
            aria-label="Back to platform"
          >
            <Mark className="size-6" />
            <span className="text-foreground">
              <BrandLockup size="footer" />
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <SidebarBody onNavigate={onClose} />
      </div>
    </div>
  );
}

function Topbar({
  crumb,
  onOpenPalette,
  onOpenMobileNav,
}: {
  crumb: string;
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const user = useAuthUser();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const initials = (user?.displayName ?? "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open menu"
        className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden text-muted-foreground sm:inline">ThreatLens</span>
        <span className="hidden text-muted-foreground sm:inline">/</span>
        <span className="font-medium">{crumb}</span>
      </div>
      <div className="ml-4 hidden min-w-0 flex-1 items-center md:flex">
        <button
          onClick={onOpenPalette}
          className="group flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-[color:var(--info)]/50"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate whitespace-nowrap text-left">
            Search users, devices, alerts, MITRE IDs…
          </span>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>
      <div className="flex-1 md:hidden" />
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[12px] text-secondary hover:text-foreground"
        >
          <Command className="size-4" />
          <span className="hidden md:inline">Command</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-secondary hover:text-foreground"
          >
            <BellIcon className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[color:var(--critical)]" />
            )}
          </button>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md border border-border bg-card py-1 pl-1 pr-2.5 transition-colors hover:border-[color:var(--info)]/50">
              <IconTile tone="info" size="sm" shape="circle" className="text-[11px] font-semibold">
                {initials}
              </IconTile>
              <div className="hidden text-left leading-tight md:block">
                <div className="text-[12px] font-medium">{user?.displayName ?? "Account"}</div>
                <div className="text-[10px] text-muted-foreground">Profile & settings</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/app/profile">Profile & settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

const crumbMap: Record<string, string> = {
  "/app": "Dashboard",
  "/app/alerts": "Alert Center",
  "/app/incidents": "Incident Queue",
  "/app/cases": "Case Management",
  "/app/evidence": "Evidence Locker",
  "/app/timeline": "Global Timeline",
  "/app/identity": "Identity Center",
  "/app/endpoints": "Device Center",
  "/app/email": "Email Investigation",
  "/app/threat-intel": "Threat Intelligence",
  "/app/search": "Global Search",
  "/app/scenarios": "Scenario Library",
  "/app/learning": "Learning Center",
  "/app/mitre": "MITRE ATT&CK Explorer",
  "/app/achievements": "Achievements",
  "/app/certificates": "Certificates",
  "/app/leaderboard": "Leaderboard",
  "/app/analytics": "Analytics",
  "/app/reports": "Reports",
  "/app/instructor": "Instructor Portal",
  "/app/student-analytics": "Student Analytics",
  "/app/scenario-builder": "Scenario Builder",
  "/app/cohorts": "Cohorts",
  "/app/assessments": "Assessments",
  "/app/feedback": "Feedback Center",
  "/app/organizations": "My Organization",
  "/app/settings": "Settings",
  "/app/audit-logs": "Audit Logs",
  "/app/billing": "Billing",
  "/app/profile": "Profile",
};

export function AppShell({ children }: { children?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const crumb =
    crumbMap[path] ?? (path.startsWith("/app/cases/") ? "Case Management" : "Dashboard");
  const { open, setOpen } = useCommandPalette();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          crumb={crumb}
          onOpenPalette={() => setOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden">
          <PageTransition>{children ?? <Outlet />}</PageTransition>
        </main>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  );
}
