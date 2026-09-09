import { type ReactNode, useState } from "react";
import { Search } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";

type PillTone = "ok" | "warn" | "danger" | "muted" | "info";

const pillToneCls: Record<PillTone, string> = {
  ok: "text-[color:var(--success)] ring-[color:var(--success)]/30 bg-[color:var(--success)]/10",
  warn: "text-[color:var(--warning)] ring-[color:var(--warning)]/30 bg-[color:var(--warning)]/10",
  danger:
    "text-[color:var(--critical)] ring-[color:var(--critical)]/30 bg-[color:var(--critical)]/10",
  info: "text-[color:var(--info)] ring-[color:var(--info)]/30 bg-[color:var(--info)]/10",
  muted: "text-muted-foreground ring-border bg-muted",
};

/** Small status pill for arbitrary admin states (account status, cert status, …). */
export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset " +
        pillToneCls[tone]
      }
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

export interface FilterSelect {
  key: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

interface AdminTableProps<T> {
  title: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;

  state: "loading" | "error" | "empty" | "ready";
  errorMessage?: string;
  emptyMessage?: string;

  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FilterSelect[];

  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  busy?: boolean;
}

const selectCls =
  "h-8 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The one admin list-table. Search, filter selects, pagination, and the four view states in
 * one place so every Management/Business/Security list looks and behaves the same.
 */
export function AdminTable<T>({
  title,
  columns,
  rows,
  rowKey,
  onRowClick,
  state,
  errorMessage = "This data is restricted to platform administrators.",
  emptyMessage = "Nothing matches.",
  search,
  filters,
  page,
  totalPages,
  total,
  onPage,
  busy,
}: AdminTableProps<T>) {
  const [searchInput, setSearchInput] = useState(search?.value ?? "");

  return (
    <Panel title={title} padded={false}>
      {(search || filters) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          {search && (
            <form
              className="flex min-w-[200px] flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                search.onChange(searchInput.trim());
              }}
            >
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={search.placeholder ?? "Search"}
                className="h-8 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
              />
              {search.value && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchInput("");
                    search.onChange("");
                  }}
                >
                  Clear
                </button>
              )}
            </form>
          )}
          {filters?.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={selectCls}
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {state === "loading" ? (
        <div className="flex flex-col gap-px p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : state === "error" ? (
        <EmptyState title="Couldn't load this data" description={errorMessage} />
      ) : state === "empty" ? (
        <EmptyState title="No results" description={emptyMessage} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={
                        "px-4 py-2.5 font-medium " + (c.align === "right" ? "text-right" : "")
                      }
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={
                      "transition-colors hover:bg-background/40 " +
                      (onRowClick ? "cursor-pointer" : "")
                    }
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={
                          "px-4 py-2.5 align-middle " +
                          (c.align === "right" ? "text-right tabular-nums" : "")
                        }
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
            <span>
              {total.toLocaleString()} total{busy && " · updating…"}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-app-ghost"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
              >
                Previous
              </button>
              <span className="tabular-nums">
                {page} / {Math.max(1, totalPages)}
              </span>
              <button
                className="btn-app-ghost"
                disabled={page >= totalPages}
                onClick={() => onPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
