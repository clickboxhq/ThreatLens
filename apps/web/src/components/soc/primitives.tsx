import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Status = "open" | "in-progress" | "resolved" | "closed" | "new" | "escalated";

const sevMap: Record<Severity, string> = {
  critical:
    "bg-[color:var(--critical)]/12 text-[color:var(--critical)] ring-[color:var(--critical)]/30",
  high: "bg-[color:var(--high)]/12 text-[color:var(--high)] ring-[color:var(--high)]/30",
  medium: "bg-[color:var(--warning)]/12 text-[color:var(--warning)] ring-[color:var(--warning)]/30",
  low: "bg-[color:var(--info)]/12 text-[color:var(--info)] ring-[color:var(--info)]/30",
  info: "bg-muted text-secondary ring-border",
};

const statusMap: Record<Status, string> = {
  open: "bg-[color:var(--info)]/10 text-[color:var(--info)] ring-[color:var(--info)]/25",
  new: "bg-[color:var(--info)]/10 text-[color:var(--info)] ring-[color:var(--info)]/25",
  "in-progress":
    "bg-[color:var(--warning)]/10 text-[color:var(--warning)] ring-[color:var(--warning)]/25",
  escalated: "bg-[color:var(--high)]/10 text-[color:var(--high)] ring-[color:var(--high)]/25",
  resolved:
    "bg-[color:var(--success)]/10 text-[color:var(--success)] ring-[color:var(--success)]/25",
  closed: "bg-muted text-muted-foreground ring-border",
};

export function SeverityBadge({ level }: { level: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset",
        sevMap[level],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset",
        statusMap[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status.replace("-", " ")}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-background px-1.5 font-mono text-[10px] text-secondary">
      {children}
    </kbd>
  );
}

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon?: ReactNode;
  tone?: "default" | "critical" | "high" | "success" | "info";
}) {
  const toneClass = {
    default: "text-foreground",
    critical: "text-[color:var(--critical)]",
    high: "text-[color:var(--high)]",
    success: "text-[color:var(--success)]",
    info: "text-[color:var(--info)]",
  }[tone];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <div className="glass-card group relative overflow-hidden p-4 transition-colors hover:border-[color:var(--card-border-tint)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
          {delta && (
            <div className="mt-1 flex items-center gap-1 text-xs text-secondary">
              {TrendIcon && <TrendIcon className="size-3" />}
              {delta}
            </div>
          )}
        </div>
        {icon && <div className="icon-frame text-secondary">{icon}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("glass-card overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-[color:var(--card-border-tint)] px-4 py-3">
          <h3 className="text-sm font-medium">{title}</h3>
          {actions}
        </div>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </div>
  );
}
