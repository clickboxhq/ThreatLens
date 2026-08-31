import { Fragment, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, X } from "lucide-react";

/**
 * Shared chrome for entity investigation surfaces (email / identity / device)
 * so every one of them opens, tabs, and closes identically rather than each
 * re-implementing a panel. Two variants:
 *
 * - "drawer" (default): the case workspace's in-place pivot — a quick
 *   preview without leaving the case, unchanged from before.
 * - "page": the standalone centralized investigation workspace
 *   (/app/identity/$sessionId/$id etc.) — same tabs and body content, full
 *   page real estate, a real back-nav instead of an overlay close button,
 *   and room for the header actions/status chips a full workspace needs.
 *
 * The tab bodies (children) are identical between the two — that's the
 * point: write the investigation content once, get both a quick-preview
 * drawer and a full centralized workspace from it.
 */
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
  variant = "drawer",
  backTo,
  backLabel = "Back",
  headerBadges,
  headerActions,
  quickPreviewLinkTo,
}: {
  kind: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tabs: readonly (readonly [T, string])[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  onClose?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  variant?: "drawer" | "page";
  /** page variant only — where the back-nav link goes. */
  backTo?: string;
  /** page variant only — back-nav label, e.g. "Back to Identity Center". Defaults to "Back". */
  backLabel?: string;
  /** page variant only — status/severity/MITRE-style chips next to the title. */
  headerBadges?: ReactNode;
  /** page variant only — primary actions (assign/escalate/etc.), top-right. */
  headerActions?: ReactNode;
  /** drawer variant only — link to the full page, shown as a "quick preview" affordance. */
  quickPreviewLinkTo?: string;
}) {
  const tabStrip = (
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
  );

  if (variant === "page") {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        {backTo && (
          <Link
            to={backTo}
            className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> {backLabel}
          </Link>
        )}
        <div className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <div className="t-label">{kind}</div>
              <h1 className="mt-1 truncate text-[19px] font-semibold">{title}</h1>
              {subtitle && <div className="mt-0.5 text-[12px] text-secondary">{subtitle}</div>}
              {headerBadges && <div className="mt-2 flex flex-wrap gap-1.5">{headerBadges}</div>}
            </div>
            {headerActions && (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            )}
          </div>
          {tabStrip}
          <div className="px-5 py-5">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </div>
      </div>
    );
  }

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
          <div className="flex shrink-0 items-center gap-1.5">
            {quickPreviewLinkTo && (
              <Link
                to={quickPreviewLinkTo}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] text-secondary hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                Open full workspace <ExternalLink className="size-3" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-border p-1.5 text-secondary hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {tabStrip}

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
