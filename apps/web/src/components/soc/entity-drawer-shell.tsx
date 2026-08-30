import { Fragment, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Shared chrome for the case workspace's entity pivots (email / identity / device) so all
 * three open, tab, and close identically rather than each re-implementing a panel. */
export function EntityDrawerShell<T extends string>({
  kind,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  footer,
  children,
}: {
  kind: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tabs: readonly (readonly [T, string])[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {kind}
            </div>
            <h2 className="mt-1 truncate text-[15px] font-semibold">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 truncate text-[11.5px] text-secondary">{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-border p-1.5 text-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-5 pt-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`whitespace-nowrap rounded-t-md px-3 py-2 text-[12px] transition-colors ${
                activeTab === id
                  ? "border-b-2 border-[color:var(--info)] font-medium text-foreground"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function DrawerEmpty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[12.5px] text-secondary">{children}</p>;
}

export function EventRow({
  title,
  meta,
  detail,
  tone,
}: {
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  tone?: "critical" | "warning" | "normal";
}) {
  const toneClass =
    tone === "critical"
      ? "text-[color:var(--critical)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "";
  return (
    <li className="px-3 py-2.5 text-[12px]">
      <div className={`truncate font-medium ${toneClass}`}>{title}</div>
      {detail && (
        <div className="mt-0.5 break-all font-mono text-[11px] text-secondary">{detail}</div>
      )}
      {meta && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{meta}</div>}
    </li>
  );
}

export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * An EventRow that opens to reveal the full record. A month of history is only useful if you
 * can interrogate a single line of it — "this one, at 03:14, from which address?" — so every
 * log row in the identity drawer expands rather than forcing a pivot elsewhere.
 */
export function ExpandableEventRow({
  title,
  meta,
  detail,
  tone,
  fields,
}: {
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  tone?: "critical" | "warning" | "normal";
  fields: [string, ReactNode][];
}) {
  const [open, setOpen] = useState(false);
  const toneClass =
    tone === "critical"
      ? "text-[color:var(--critical)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "";

  return (
    <li className="text-[12px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 text-left hover:bg-background/40"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-medium ${toneClass}`}>{title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {open ? "Hide" : "Details"}
          </span>
        </div>
        {detail && <div className="mt-0.5 text-[11px] text-secondary">{detail}</div>}
        {meta && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{meta}</div>}
      </button>
      {open && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border bg-background/40 px-3 py-2 text-[11px]">
          {fields.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-all">{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </li>
  );
}
