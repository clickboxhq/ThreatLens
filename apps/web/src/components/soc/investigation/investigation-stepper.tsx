import { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Lightbulb,
  NotebookPen,
  Radar,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ConfirmDialog } from "@/components/soc/ui/confirm-dialog";
import type { HintDto } from "@/types/threatlens-investigation";

export type Stage =
  "investigate" | "evidence" | "response" | "intelligence" | "notes" | "review" | "submit";

export const STAGES: { id: Stage; label: string; icon: typeof FileSearch }[] = [
  { id: "investigate", label: "Investigate", icon: FileSearch },
  { id: "evidence", label: "Evidence", icon: ClipboardList },
  { id: "response", label: "Response", icon: Zap },
  { id: "intelligence", label: "Intelligence", icon: Radar },
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "review", label: "Review", icon: CheckCircle2 },
  { id: "submit", label: "Submit", icon: ShieldCheck },
];

/**
 * Compact top progress/nav — the brief's "Option A + recommended direction" combined: every
 * stage is always independently reachable (never a forced linear wizard; the brief explicitly
 * wants backward navigation before submission), with a `done` dot wherever the parent has a
 * real, non-fabricated completeness signal for that stage (e.g. evidence pinned > 0). Stages
 * with no natural "done" concept (Investigate, Review, Submit) just show current/not-current.
 */
export function InvestigationStepper({
  active,
  done,
  onNavigate,
  locked,
  hints,
  nextHintCost,
  onUnlockHint,
}: {
  active: Stage;
  done: Partial<Record<Stage, boolean>>;
  onNavigate: (stage: Stage) => void;
  locked: boolean;
  hints: HintDto[];
  nextHintCost: number | null;
  onUnlockHint: () => void;
}) {
  const [confirmHintOpen, setConfirmHintOpen] = useState(false);
  const unlockedCount = hints.filter((h) => h.unlocked).length;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur md:-mx-8 md:px-8">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.id === active;
          const isDone = done[s.id];
          return (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "bg-[color:var(--info)]/12 text-[color:var(--info)]"
                  : "text-secondary hover:bg-card hover:text-foreground"
              }`}
            >
              <span className="text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
              <Icon className="size-3.5" />
              {s.label}
              {isDone && !isActive && (
                <CheckCircle2 className="size-3 text-[color:var(--success)]" />
              )}
            </button>
          );
        })}

        <div className="ml-auto shrink-0">
          {!locked && (
            <button
              onClick={() => setConfirmHintOpen(true)}
              disabled={!nextHintCost}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11.5px] text-secondary hover:text-foreground disabled:opacity-50"
            >
              <Lightbulb className="size-3.5" />
              Hints · {unlockedCount}/{hints.length} used
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmHintOpen}
        onOpenChange={setConfirmHintOpen}
        tone="default"
        title="Request investigation hint?"
        description={
          nextHintCost != null
            ? `Using this hint will cost ${nextHintCost}% of your final score.`
            : "Using a hint affects your final investigation score."
        }
        confirmLabel="Reveal hint"
        onConfirm={onUnlockHint}
      />
    </div>
  );
}
