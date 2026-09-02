import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const STEPS = [
  "Loading telemetry…",
  "Preparing evidence workspace…",
  "Initializing investigation context…",
  "Establishing analyst session…",
];

/**
 * The brief pause between "Begin Investigation" and the workspace appearing. The step copy
 * advances on a timer for polish, but the transition itself isn't a fake delay — the caller
 * uses this window to prefetch evidence/timeline/notes/hints (see CaseWorkspaceInner), so the
 * Investigate stage is warm the moment this unmounts rather than showing its own spinner next.
 */
export function InvestigationTransition() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 380);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader2 className="size-6 animate-spin text-[color:var(--info)]" />
      <div>
        <h2 className="text-[14.5px] font-semibold">Preparing investigation workspace…</h2>
        <p className="mt-1.5 text-[12px] text-muted-foreground">{STEPS[stepIndex]}</p>
      </div>
    </div>
  );
}
