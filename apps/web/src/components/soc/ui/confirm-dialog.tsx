import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Delete case?" */
  title: string;
  /** e.g. "You are about to permanently delete:" */
  description: string;
  /** The name of the thing being deleted, shown bold under the description. */
  target?: string;
  /** Extra context line, e.g. "This action may remove associated investigation information." */
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  /**
   * For highly destructive, hard-to-reverse actions: require the user to
   * type this exact word (case-insensitive) before Confirm is enabled.
   */
  typeToConfirm?: string;
  /** Called on confirm. May be async — the dialog shows a pending state and
   * only closes after it resolves, so the user never wonders whether the
   * click registered. Throwing shows an error toast and keeps the dialog open. */
  onConfirm: () => void | Promise<void>;
};

/**
 * The one shared destructive-action confirmation dialog for ThreatLens.
 * Wrap any delete/remove/revoke action in this instead of hand-rolling a
 * confirm prompt — gives every destructive action the same pending state,
 * error handling, and (optionally) type-to-confirm friction.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  target,
  note,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "destructive",
  typeToConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [typed, setTyped] = useState("");

  const locked =
    Boolean(typeToConfirm) && typed.trim().toLowerCase() !== typeToConfirm?.toLowerCase();

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't go through. Try again.");
    } finally {
      setPending(false);
      setTyped("");
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
          if (!next) setTyped("");
        }
      }}
    >
      <AlertDialogContent className="glass-card border-border bg-card sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2.5">
            {tone === "destructive" && (
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-critical/12 text-critical">
                <AlertTriangle className="size-4" />
              </span>
            )}
            <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-secondary-foreground">
            {description}
          </AlertDialogDescription>
          {target && <p className="t-h2 text-foreground">{target}</p>}
          {note && <p className="t-meta text-muted-foreground">{note}</p>}
        </AlertDialogHeader>

        {typeToConfirm && (
          <label className="block">
            <span className="t-label mb-1.5 block">
              Type{" "}
              <span className="font-mono normal-case tracking-normal text-foreground">
                {typeToConfirm}
              </span>{" "}
              to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={typeToConfirm}
            />
          </label>
        )}

        <AlertDialogFooter>
          <button
            type="button"
            className="btn-app-ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "destructive" ? "btn-app-danger" : "btn-app-primary"}
            disabled={pending || locked}
            onClick={handleConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
