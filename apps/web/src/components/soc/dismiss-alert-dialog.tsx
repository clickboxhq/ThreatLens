import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// The server insists on a reason of at least this length (UpdateAlertStatusDto), and so does
// the score: a dismissal without one is not a triage decision, it is a click.
const MIN_REASON = 10;

/**
 * "Dismiss" is a judgement, and the reason is the judgement written down. Used for a single
 * alert from the Triage stage and for a selection from the Alert Center; one reason covers
 * every alert in the selection, which is how a real queue is worked ("all four are the
 * scheduled export, see ticket").
 */
export function DismissAlertDialog({
  open,
  onOpenChange,
  alertTitles,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertTitles: string[];
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const tooShort = reason.trim().length < MIN_REASON;
  const count = alertTitles.length;

  const close = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
    if (!next) setReason("");
  };

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm(reason.trim());
      onOpenChange(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not dismiss. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="glass-card border-border bg-card sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            {count === 1 ? "Dismiss this alert?" : `Dismiss ${count} alerts?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-secondary-foreground">
            You are saying this is not part of the incident. Write down why — the reason is what
            makes it a decision rather than a click, and it is scored.
          </AlertDialogDescription>
          {count === 1 ? (
            <p className="t-h2 text-foreground">{alertTitles[0]}</p>
          ) : (
            <ul className="mt-1 max-h-28 overflow-y-auto text-[11.5px] text-secondary">
              {alertTitles.map((t, i) => (
                <li key={i} className="truncate">
                  · {t}
                </li>
              ))}
            </ul>
          )}
        </AlertDialogHeader>

        <label className="block">
          <span className="t-label mb-1.5 block">Reason</span>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. Confirmed with the user — VPN sign-in while travelling, ticket INC-48213"
          />
          <span className="mt-1 block text-[10.5px] text-muted-foreground">
            {tooShort
              ? `At least ${MIN_REASON} characters.`
              : "Say what you checked, not just what you concluded."}
          </span>
        </label>

        <AlertDialogFooter>
          <button
            type="button"
            className="btn-app-ghost"
            disabled={pending}
            onClick={() => close(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-app-primary"
            disabled={pending || tooShort}
            onClick={handleConfirm}
          >
            {pending ? "Dismissing…" : count === 1 ? "Dismiss alert" : `Dismiss ${count}`}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
