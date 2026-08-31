import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Copy, Radar } from "lucide-react";
import type { IndicatorType } from "@/types/threat-intel-page";

type PivotType = IndicatorType;

/**
 * A clickable indicator value (IP/domain/hash/URL) that opens a menu to either look it up in
 * Threat Intelligence (pre-filled, real navigation — not a dead chip) or copy it. The first
 * real cross-module pivot point outside the case workspace's own hand-rolled lookup form.
 */
export function PivotableValue({
  value,
  type,
  className,
  display,
}: {
  value: string;
  type: PivotType;
  className?: string;
  /** What to render on the trigger, if different from the raw value (e.g. a truncated hash). The full `value` is still what gets looked up or copied. */
  display?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={
          className ??
          "font-mono text-[11.5px] text-[color:var(--info)] underline decoration-dotted underline-offset-2 hover:decoration-solid"
        }
      >
        {display ?? value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-elev-2">
            <button
              onClick={() => {
                setOpen(false);
                navigate({ to: "/app/threat-intel", search: { type, value } });
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-background/60"
            >
              <Radar className="size-3.5 text-muted-foreground" /> Look up in Threat Intel
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(value);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {
                  // clipboard permission denied — no worse off than before
                }
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-background/60"
            >
              {copied ? (
                <Check className="size-3.5 text-[color:var(--success)]" />
              ) : (
                <Copy className="size-3.5 text-muted-foreground" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}
    </span>
  );
}
