import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAlerts } from "@/hooks/use-alerts";
import { useIdentities } from "@/hooks/use-identities";
import { useEndpoints } from "@/hooks/use-endpoints";
import { useScenarios } from "@/hooks/use-scenarios";
import {
  LayoutGrid,
  ShieldAlert,
  Bell,
  Inbox,
  UserRound,
  MonitorSmartphone,
  Mail,
  Radar,
  Library,
  GraduationCap,
  Award,
  BarChart3,
  FileText,
  Presentation,
  Building2,
  Settings as SettingsIcon,
  CircleUserRound,
  Search,
} from "lucide-react";

const modules = [
  { to: "/app", label: "Dashboard", icon: LayoutGrid },
  { to: "/app/cases", label: "Case Management", icon: Inbox },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/incidents", label: "Incident Queue", icon: ShieldAlert },
  { to: "/app/identity", label: "Identity Center", icon: UserRound },
  { to: "/app/endpoints", label: "Endpoint Center", icon: MonitorSmartphone },
  { to: "/app/email", label: "Email Investigations", icon: Mail },
  { to: "/app/threat-intel", label: "Threat Intelligence", icon: Radar },
  { to: "/app/scenarios", label: "Scenario Library", icon: Library },
  { to: "/app/learning", label: "Learning Center", icon: GraduationCap },
  { to: "/app/certificates", label: "Certificates", icon: Award },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/reports", label: "Reports", icon: FileText },
  { to: "/app/instructor", label: "Instructor Portal", icon: Presentation },
  { to: "/app/organizations", label: "Organizations", icon: Building2 },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
  { to: "/app/profile", label: "Profile", icon: CircleUserRound },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { alerts } = useAlerts();
  const { identities } = useIdentities();
  const { endpoints } = useEndpoints();
  const { scenarios } = useScenarios();

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global command palette" shouldFilter>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="size-4 text-muted-foreground" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder="Jump to module, user, alert, device, MITRE ID…"
              className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              No results.
            </Command.Empty>

            <Command.Group
              heading="Modules"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <Command.Item
                    key={m.to}
                    value={`module ${m.label}`}
                    onSelect={() => go(m.to)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-[color:var(--info)]/15"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    {m.label}
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group heading="Alerts">
              {alerts.slice(0, 20).map((a) => (
                <Command.Item
                  key={a.id}
                  value={`alert ${a.id} ${a.name} ${a.mitre} ${a.user}`}
                  onSelect={() => go("/app/alerts")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-[color:var(--info)]/15"
                >
                  <Bell className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{a.id}</span>
                  <span className="truncate">{a.name}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Users">
              {identities.map((i) => (
                <Command.Item
                  key={i.upn}
                  value={`user ${i.name} ${i.upn} ${i.dept}`}
                  onSelect={() => go("/app/identity")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-[color:var(--info)]/15"
                >
                  <UserRound className="size-3.5 text-muted-foreground" />
                  {i.name}
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {i.upn}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Devices">
              {endpoints.map((e) => (
                <Command.Item
                  key={e.host}
                  value={`device ${e.host} ${e.owner}`}
                  onSelect={() => go("/app/endpoints")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-[color:var(--info)]/15"
                >
                  <MonitorSmartphone className="size-3.5 text-muted-foreground" />
                  {e.host}
                  <span className="ml-auto text-[11px] text-muted-foreground">{e.owner}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Scenarios">
              {scenarios.map((s) => (
                <Command.Item
                  key={s.id}
                  value={`scenario ${s.id} ${s.title} ${s.mitre.join(" ")}`}
                  onSelect={() => go("/app/scenarios")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] data-[selected=true]:bg-[color:var(--info)]/15"
                >
                  <Library className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">{s.id}</span>
                  <span className="truncate">{s.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
