import { useState } from "react";
import { Lightbulb, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { HintDto } from "@/types/threatlens-investigation";

/**
 * Where an unlocked hint is actually read.
 *
 * The API has always returned the text — `list()` fills it in for every unlocked index — but
 * nothing in the investigation UI rendered it. Unlocking showed a confirmation, charged the
 * score penalty, ticked the counter from 0/3 to 1/3, and revealed nothing, under a button
 * labelled "Reveal hint". The whole feature was unusable and still cost you marks.
 *
 * A panel rather than a one-shot reveal, because a hint that is paid for should stay readable
 * for the rest of the investigation. Costs are shown before committing, never after.
 */
export function HintsDialog({
  open,
  onOpenChange,
  hints,
  locked,
  onUnlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hints: HintDto[];
  /** The session is submitted — nothing further can be unlocked, but what was paid for stays. */
  locked: boolean;
  onUnlock: (index: number) => Promise<unknown>;
}) {
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const nextIndex = hints.find((h) => !h.unlocked)?.index ?? null;

  async function reveal(index: number) {
    setUnlocking(index);
    try {
      await onUnlock(index);
      setConfirming(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlock that hint.");
    } finally {
      setUnlocking(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="size-4 text-[color:var(--warning)]" />
            Investigation hints
          </DialogTitle>
          <DialogDescription>
            Each hint costs a percentage of your final score. Once unlocked it stays available for
            the rest of this investigation.
          </DialogDescription>
        </DialogHeader>

        {hints.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            This scenario has no hints.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {hints.map((hint) => {
              const isNext = hint.index === nextIndex;
              return (
                <li
                  key={hint.index}
                  className="rounded-md border border-border bg-background/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Hint {hint.index + 1}
                    </span>
                    {!hint.unlocked && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        −{hint.unlockCostPercent}%
                      </span>
                    )}
                  </div>

                  {hint.unlocked ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground">
                      {hint.text}
                    </p>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                        <Lock className="size-3" />
                        {/* Hints unlock in order, so say so rather than silently disabling. */}
                        {isNext ? "Not yet revealed" : "Unlock the earlier hints first"}
                      </span>
                      {isNext &&
                        !locked &&
                        (confirming === hint.index ? (
                          <span className="flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[12px]"
                              onClick={() => setConfirming(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-[12px]"
                              disabled={unlocking !== null}
                              onClick={() => void reveal(hint.index)}
                            >
                              {unlocking === hint.index
                                ? "Revealing…"
                                : `Confirm −${hint.unlockCostPercent}%`}
                            </Button>
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 text-[12px]"
                            onClick={() => setConfirming(hint.index)}
                          >
                            Reveal
                          </Button>
                        ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
