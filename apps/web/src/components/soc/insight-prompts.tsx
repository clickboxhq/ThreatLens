import { useState } from "react";
import { Loader2, HelpCircle } from "lucide-react";
import type { EntityInsightDto } from "@/types/socverse-operations";

/**
 * The questions a competent analyst asks of an entity — shown as questions, with the answer
 * folded away until the learner opens it.
 *
 * Production consoles do the opposite. Sentinel's "Top insights" pre-answers expert questions so
 * an analyst under time pressure never has to know what to ask; that is right when the scarce
 * resource is time. Here the scarce resource is knowing which question matters, so pre-answering
 * would quietly remove the skill this product exists to build. Same curated question set,
 * inverted into a prompt.
 *
 * "Notable" marks the observation as unusual, never as malicious. A legitimate business trip and
 * a stolen credential produce an identical first-sign-in-from-a-new-country; deciding between
 * them is the exercise, and in a false-positive scenario the notable prompt is precisely the one
 * the learner has to clear.
 */
export function InsightPrompts({
  insights,
  isPending,
}: {
  insights: EntityInsightDto[] | undefined;
  isPending: boolean;
}) {
  const [opened, setOpened] = useState<Set<string>>(new Set());

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-4 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Working out what to ask…
      </div>
    );
  }
  if (!insights || insights.length === 0) return null;

  const toggle = (id: string) =>
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const notable = insights.filter((i) => i.tone === "notable").length;

  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <HelpCircle className="size-3" />
          Questions worth asking
        </div>
        {notable > 0 && (
          <span className="text-[10.5px] text-[color:var(--warning)]">{notable} unusual</span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-[1.5] text-muted-foreground">
        Answer these yourself first, then open one to check. “Unusual” means the data stands out —
        not that it is malicious.
      </p>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {insights.map((i) => {
          const isOpen = opened.has(i.id);
          return (
            <li key={i.id} className="rounded-md border border-border bg-card">
              <button
                onClick={() => toggle(i.id)}
                className="flex w-full items-start gap-2 px-2.5 py-2 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-[5px] size-1.5 shrink-0 rounded-full ${
                    i.tone === "notable" ? "bg-[color:var(--warning)]" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="flex-1 text-[12px] font-medium leading-[1.45]">{i.question}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {isOpen ? "Hide" : "Check"}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-border px-2.5 py-2">
                  <p className="text-[12px] leading-[1.55] text-secondary">{i.answer}</p>
                  {i.detail && (
                    <p className="mt-1 text-[10.5px] leading-[1.5] text-muted-foreground">
                      {i.detail}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
