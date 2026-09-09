import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  ShieldAlert,
  Bell,
  BookOpen,
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
  PanelLeftClose,
  PanelLeftOpen,
  Archive,
  Terminal,
  Network as NetworkIcon,
  Waypoints,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { CommandPalette, useCommandPalette } from "@/components/soc/command-palette";
import { NotificationPanel } from "@/components/soc/notification-panel";
import { useNotifications } from "@/hooks/use-notifications";
import { PageTransition } from "@/components/soc/ui/motion";
import { EmailVerificationBanner } from "@/components/soc/email-verification-banner";
import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { useAuthStore, useAuthUser } from "@/lib/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/soc/ui/user-avatar";
import { LogOut } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SIDEBAR_COLLAPSED_KEY = "threatlens:sidebar-collapsed";

// WORKSPACE — day-to-day triage/case work. "Closed Alerts & Cases" and any
// count badges are intentionally absent: this is a per-session training
// platform, not a live SOC with a real global queue, so a hardcoded "48"
// badge would be exactly the fake-functionality the product is not supposed
// to ship. Closed Alerts & Cases is added to this group once its route
// exists (see the archive/learning-review pass).
const workspace: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/alerts", label: "Alert Center", icon: Bell },
  { to: "/app/incidents", label: "Incident Queue", icon: ShieldAlert },
  { to: "/app/cases", label: "Case Management", icon: Inbox },
  { to: "/app/timeline", label: "Global Timeline", icon: ListTree },
  { to: "/app/evidence", label: "Evidence Locker", icon: HardDrive },
  { to: "/app/graph", label: "Investigation Graph", icon: Waypoints },
  { to: "/app/closed", label: "Closed Alerts & Cases", icon: Archive },
];

// INVESTIGATION CENTERS — the per-domain investigation surfaces.
const investigationCenters: NavItem[] = [
  { to: "/app/identity", label: "Identity Center", icon: UserRound },
  { to: "/app/endpoints", label: "Endpoint Center", icon: MonitorSmartphone },
  { to: "/app/network", label: "Network Center", icon: NetworkIcon },
  { to: "/app/email", label: "Email Investigation", icon: Mail },
  { to: "/app/threat-intel", label: "Threat Intelligence", icon: Radar },
  { to: "/app/search", label: "Global Search", icon: Search },
  { to: "/app/logs", label: "Log Explorer", icon: Terminal },
];

// LEARNING & PRACTICE — content and mastery.
const learning: NavItem[] = [
  { to: "/app/scenarios", label: "Scenario Library", icon: Library },
  { to: "/app/learning", label: "Learning Center", icon: GraduationCap },
  { to: "/app/mitre", label: "MITRE ATT&CK Explorer", icon: Crosshair },
  { to: "/app/achievements", label: "Achievements", icon: Medal },
  { to: "/app/certificates", label: "Certificates", icon: Award },
  { to: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  // Everyone needs the guide, so it sits in a group that is not role-gated. It was briefly
  // in Organization, which only renders for org accounts — individual users saw nothing.
  { to: "/app/docs", label: "Documentation", icon: BookOpen },
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
];

// Platform-operator surface — every route below is gated to platform_admin specifically on
// the backend (RolesGuard); an instructor or org_admin clicking any of them gets a 403. The
// five groups mirror the admin panel's own information architecture.
const adminOverview: NavItem[] = [
  { to: "/app/admin", label: "Overview", icon: LayoutGrid },
  { to: "/app/admin/analytics", label: "Platform Analytics", icon: BarChart3 },
];
const adminManagement: NavItem[] = [
  { to: "/app/admin/users", label: "Users", icon: Users },
  { to: "/app/admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/app/admin/certificates", label: "Certificates", icon: Award },
];
const adminBusiness: NavItem[] = [
  { to: "/app/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { to: "/app/admin/revenue", label: "Revenue", icon: Banknote },
];
const adminSecurity: NavItem[] = [
  { to: "/app/admin/security", label: "Security Events", icon: ShieldAlert },
  { to: "/app/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/app/admin/administrators", label: "Administrators", icon: ShieldCheck },
];
const adminSystem: NavItem[] = [
  { to: "/app/admin/settings", label: "Platform Settings", icon: SettingsIcon },
];

function NavGroup({
  label,
  items,
  collapsed,
}: {
  label?: string;
  items: NavItem[];
  collapsed?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="px-2">
      {label && !collapsed && (
        <div className="mb-1 px-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      )}
      {label && collapsed && <div className="pt-4" aria-hidden />}
      <ul className="flex flex-col gap-0.5">
        {items.map((it) => {
          // "/app" and "/app/admin" are exact-match — otherwise "/app/admin" would light up
          // for every /app/admin/* sub-route alongside the actual page.
          const active =
            it.to === "/app" || it.to === "/app/admin" ? path === it.to : path.startsWith(it.to);
          const Icon = it.icon;
          const link = (
            <Link
              to={it.to}
              className={cn(
                "transition-app group relative flex items-center gap-2.5 rounded-md py-1.5 text-[13px]",
                collapsed ? "justify-center px-0" : "pl-3.5 pr-2",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[color:var(--info)]",
                    collapsed ? "-left-0.5" : "-left-2",
                  )}
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
              {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
            </Link>
          );
          return (
            <li key={it.to}>
              {collapsed ? (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{it.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarBody({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const user = useAuthUser();
  // "Organization" nav (instructor tools, org settings) now gates on the real role ThreatLens
  // issued at signup/login, not the old accountType mock flag — org_admin included for when a
  // real admin-provisioned account (no self-serve path) logs in.
  const isOrg = user?.role === "instructor" || user?.role === "org_admin";
  const isPlatformAdmin = user?.role === "platform_admin";
  const accountName = user?.displayName ?? "Account";

  return (
    <TooltipProvider delayDuration={200}>
      {/* Workspace switcher */}
      <div className="p-3">
        <button
          className={cn(
            "transition-app flex w-full items-center gap-2.5 rounded-md border border-[color:var(--card-border-tint)] bg-background/40 py-2 text-left hover:bg-sidebar-accent/50",
            collapsed ? "justify-center px-0" : "px-2.5",
          )}
        >
          <IconTile tone="info" size="sm">
            {isOrg ? <Building2 className="size-4" /> : <CircleUserRound className="size-4" />}
          </IconTile>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{accountName}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {isOrg ? "Organization workspace" : "Individual"}
                </div>
              </div>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4" onClick={onNavigate}>
        <NavGroup label="Workspace" items={workspace} collapsed={collapsed} />
        <NavGroup
          label="Investigation Centers"
          items={investigationCenters}
          collapsed={collapsed}
        />
        <NavGroup label="Learning & Practice" items={learning} collapsed={collapsed} />
        {isOrg && (
          <NavGroup label="Instructor Tools" items={instructorTools} collapsed={collapsed} />
        )}
        {isOrg && <NavGroup label="Organization" items={organization} collapsed={collapsed} />}
        {isPlatformAdmin && (
          <>
            <div className="mx-2 mt-5 border-t border-sidebar-border pt-3">
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">
                  <ShieldCheck className="size-3.5 text-[color:var(--info)]" />
                  Admin Panel
                </div>
              )}
            </div>
            <NavGroup label="Overview" items={adminOverview} collapsed={collapsed} />
            <NavGroup label="Management" items={adminManagement} collapsed={collapsed} />
            <NavGroup label="Business" items={adminBusiness} collapsed={collapsed} />
            <NavGroup label="Security" items={adminSecurity} collapsed={collapsed} />
            <NavGroup label="System" items={adminSystem} collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Footer: plan + docs + support — hidden in collapsed mode, not worth the icon-only
          treatment. Storage stays dropped (§1.6 "no fake UI"): it was a hardcoded number with
          no backing quota. Docs is back, because there is now a real guide to send people to
          rather than the href="#" it used to be. */}
      {!collapsed && (
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg border border-[color:var(--card-border-tint)] bg-background/40 p-3">
            <div className="flex items-center gap-2 text-[11px] text-secondary">
              <Sparkles className="size-3.5 text-[color:var(--info)]" />
              <span className="font-medium text-foreground">
                {isOrg ? "Cohort Plan" : "Individual Plan"}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <Link to="/app/docs" className="inline-flex items-center gap-1 hover:text-foreground">
                <BookOpen className="size-3.5" /> Docs
              </Link>
              <a
                href="mailto:info@useclickbox.com"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <LifeBuoy className="size-3.5" /> Support
              </a>
              {/* Everyone gets Pricing rather than org users getting Billing: billing is not
               * built, so that link led to a page saying so. */}
              <Link
                to="/"
                hash="pricing"
                className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
              >
                <CreditCard className="size-3.5" /> Pricing
              </Link>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}

function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={cn(
        "transition-app hidden shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col",
        collapsed ? "w-[68px]" : "w-[248px]",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border p-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <Mark className="size-6" />
            <span className="text-foreground">
              <BrandLockup size="footer" />
            </span>
          </Link>
        )}
        {collapsed && (
          <Link to="/" aria-label="ThreatLens" title="ThreatLens">
            <Mark className="size-6" />
          </Link>
        )}
      </div>
      <SidebarBody collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="transition-app flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span className="text-[12px]">Collapse</span>}
        </button>
      </div>
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
              {user && <UserAvatar user={user} size={28} />}
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
  "/app/graph": "Investigation Graph",
  "/app/closed": "Closed Alerts & Cases",
  "/app/timeline": "Global Timeline",
  "/app/identity": "Identity Center",
  "/app/endpoints": "Endpoint Center",
  "/app/network": "Network Center",
  "/app/email": "Email Investigation",
  "/app/threat-intel": "Threat Intelligence",
  "/app/search": "Global Search",
  "/app/logs": "Log Explorer",
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
    crumbMap[path] ??
    (path.startsWith("/app/cases/")
      ? "Case Management"
      : path.startsWith("/app/identity/")
        ? "Identity Center"
        : path.startsWith("/app/endpoints/")
          ? "Endpoint Center"
          : path.startsWith("/app/email/")
            ? "Email Investigation"
            : "Dashboard");
  const { open, setOpen } = useCommandPalette();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Collapsed sidebar preference persists per-browser (not per-user server
  // state — this is a UI density preference, not account data). Starts
  // `false` to match the server-rendered markup exactly, then reads
  // localStorage in an effect (client-only, post-hydration) — reading it in
  // the useState initializer instead would make the client's first render
  // diverge from the server's and trigger a hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // localStorage unavailable — stay expanded.
    }
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [path]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage unavailable (private browsing, etc.) — preference just won't persist.
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          crumb={crumb}
          onOpenPalette={() => setOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <EmailVerificationBanner />
        <main className="flex-1 overflow-x-hidden">
          <PageTransition>{children ?? <Outlet />}</PageTransition>
        </main>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </div>
  );
}
